import { supabase } from '../lib/supabase';

const readMany = async (table, options = {}) => {
  const {
    columns = '*',
    orderBy,
    ascending = false,
    limit,
  } = options;

  let query = supabase.from(table).select(columns);

  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Resolve o nome do ator dos eventos pelo profiles (caso actor_name tenha vindo nulo do app).
const attachActor = async (rows) => {
  const ids = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
  if (!ids.length) return rows || [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .in('user_id', ids);

  const byId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  return (rows || []).map((row) => {
    const profile = byId.get(row.user_id);
    return { ...row, actor_name: row.actor_name || profile?.name || profile?.email || null };
  });
};

const toBonusQueueItem = (item = {}, index = 0) => {
  const packagingOptions = Array.isArray(item.packagingOptions) ? item.packagingOptions : [];
  const firstPackaging = packagingOptions[0] || null;

  return {
    line_number: Number(item.lineNumber || item.line_number || index + 1),
    code: item.code || null,
    ean: item.ean || firstPackaging?.ean || null,
    dun: item.dun || firstPackaging?.dun || null,
    description: item.description || `Item ${index + 1}`,
    unit: item.unit || firstPackaging?.label || 'UN',
    expected_qty: Number(item.expectedQty || item.expected_qty || 0),
    packaging_options: packagingOptions.map((option, optionIndex) => ({
      id: option.id || `pkg-${optionIndex + 1}`,
      label: option.label || option.unit || 'UN',
      factor: Number(option.factor || 1),
      ean: option.ean || '',
      dun: option.dun || '',
    })),
  };
};

const ensureOpenQueueDoesNotExist = async (invoiceNumber) => {
  const normalizedInvoice = String(invoiceNumber || '').trim();
  if (!normalizedInvoice) {
    throw new Error('Informe a NF do bônus.');
  }

  const existingOpenQueue = await supabase
    .from('conferencia_bonus_queue')
    .select('id, invoice_number, status')
    .eq('invoice_number', normalizedInvoice)
    .in('status', ['nao_iniciado', 'em_conferencia'])
    .maybeSingle();

  if (existingOpenQueue.error) {
    throw existingOpenQueue.error;
  }

  if (existingOpenQueue.data) {
    throw new Error(`Ja existe bônus aberto para a NF ${normalizedInvoice}.`);
  }
};

const generateBusinessCode = (prefix, fallback = '') => {
  const now = new Date();
  const dateChunk = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timeChunk = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const normalizedFallback = String(fallback || '').replace(/\D+/g, '').slice(-6);
  const suffix = normalizedFallback || String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `${prefix}-${dateChunk}-${timeChunk}-${suffix}`;
};

const normalizePurchaseOrderItem = (item = {}, index = 0) => ({
  line_number: Number(item.line_number || item.lineNumber || index + 1),
  code: String(item.code || '').trim() || null,
  ean: String(item.ean || '').trim() || null,
  dun: String(item.dun || '').trim() || null,
  description: String(item.description || '').trim() || `Item ${index + 1}`,
  unit: String(item.unit || 'UN').trim() || 'UN',
  expected_qty: Number(item.expected_qty || item.expectedQty || 0),
  received_qty: Number(item.received_qty || item.receivedQty || 0),
  divergence_qty: Number(item.divergence_qty || item.divergenceQty || 0),
  packaging_options: Array.isArray(item.packaging_options)
    ? item.packaging_options
    : Array.isArray(item.packagingOptions)
      ? item.packagingOptions
      : [],
});

const insertPurchaseOrderAction = async ({
  orderId,
  createdBy,
  actionType,
  actionLabel,
  payload = {},
  notes = null,
}) => {
  const { error } = await supabase
    .from('purchase_order_actions')
    .insert([
      {
        order_id: orderId,
        created_by: createdBy,
        action_type: actionType,
        action_label: actionLabel,
        notes,
        payload,
      },
    ]);

  if (error) {
    throw error;
  }
};

const insertPurchaseOrderWithItems = async ({
  orderInput,
  items,
  createdBy,
}) => {
  const normalizedItems = (items || []).map(normalizePurchaseOrderItem)
    .filter((item) => item.description);

  if (!normalizedItems.length) {
    throw new Error('Adicione pelo menos um item ao pedido.');
  }

  const orderNumber = String(orderInput.order_number || '').trim()
    || generateBusinessCode('PC', orderInput.invoice_number);

  const { data: orderRow, error: orderError } = await supabase
    .from('purchase_orders')
    .insert([
      {
        created_by: createdBy,
        order_number: orderNumber,
        source_type: orderInput.source_type || 'manual',
        supplier_name: orderInput.supplier_name,
        supplier_code: orderInput.supplier_code || null,
        supplier_document: orderInput.supplier_document || null,
        invoice_number: orderInput.invoice_number || null,
        invoice_key: orderInput.invoice_key || null,
        issued_at: orderInput.issued_at || null,
        status: orderInput.status || 'pedido_criado',
        entry_status: orderInput.entry_status || 'pendente',
        bonus_status: orderInput.bonus_status || 'nao_gerado',
        return_status: orderInput.return_status || 'sem_devolucao',
        audit_status: orderInput.audit_status || 'pendente',
        item_count: normalizedItems.length,
        total_quantity: normalizedItems.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0),
        xml_payload: orderInput.xml_payload || {},
        extra: orderInput.extra || {},
      },
    ])
    .select('*')
    .single();

  if (orderError) {
    throw orderError;
  }

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(
      normalizedItems.map((item) => ({
        order_id: orderRow.id,
        created_by: createdBy,
        ...item,
      })),
    );

  if (itemsError) {
    throw itemsError;
  }

  await insertPurchaseOrderAction({
    orderId: orderRow.id,
    createdBy,
    actionType: 'pedido_criado',
    actionLabel: 'Pedido criado',
    payload: {
      order_number: orderRow.order_number,
      source_type: orderRow.source_type,
      item_count: orderRow.item_count,
      total_quantity: orderRow.total_quantity,
    },
  });

  return orderRow;
};

export const adminApi = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '').trim(),
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user || null;
  },

  async assertAdmin(userId) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getDashboardSummary() {
    const rows = await readMany('admin_dashboard_summary_view', { limit: 1 });
    return rows[0] || null;
  },

  async getActiveUsers() {
    return readMany('admin_active_users_view', {
      orderBy: 'last_heartbeat_at',
      ascending: false,
      limit: 40,
    });
  },

  async getAssignableUsers() {
    const [activeUsersResult, adminUsersResult] = await Promise.all([
      supabase
        .from('admin_active_users_view')
        .select('user_id, name, email, status, current_module'),
      supabase
        .from('admin_users')
        .select('user_id, role'),
    ]);

    if (activeUsersResult.error) {
      throw new Error('Falha ao carregar usuários ativos para atribuição.');
    }

    if (adminUsersResult.error) {
      throw new Error('Falha ao carregar usuários admin para atribuição.');
    }

    const adminUserIds = (adminUsersResult.data || [])
      .map((row) => row.user_id)
      .filter(Boolean);

    let profilesByUserId = new Map();

    if (adminUserIds.length) {
      const profilesResult = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', adminUserIds);

      if (profilesResult.error) {
        throw new Error('Falha ao carregar perfis dos usuários admin.');
      }

      profilesByUserId = new Map(
        (profilesResult.data || []).map((profile) => [profile.user_id, profile]),
      );
    }

    const merged = new Map();

    (activeUsersResult.data || []).forEach((user) => {
      merged.set(user.user_id, {
        user_id: user.user_id,
        name: user.name || '',
        email: user.email || '',
        role: 'active',
        status: user.status || 'online',
        current_module: user.current_module || '',
      });
    });

    (adminUsersResult.data || []).forEach((row) => {
      const profile = profilesByUserId.get(row.user_id);
      const existing = merged.get(row.user_id);

      merged.set(row.user_id, {
        user_id: row.user_id,
        name: existing?.name || profile?.name || '',
        email: existing?.email || profile?.email || '',
        role: row.role || existing?.role || 'admin',
        status: existing?.status || 'offline',
        current_module: existing?.current_module || '',
      });
    });

    return Array.from(merged.values()).sort((left, right) => {
      const leftName = String(left.name || left.email || '').toLowerCase();
      const rightName = String(right.name || right.email || '').toLowerCase();
      return leftName.localeCompare(rightName, 'pt-BR');
    });
  },

  async getTratativas() {
    return readMany('admin_tratativas_view', {
      orderBy: 'updated_at',
      ascending: false,
      limit: 50,
    });
  },

  async getValidade() {
    return readMany('admin_validade_products_view', {
      orderBy: 'updated_at',
      ascending: false,
      limit: 50,
    });
  },

  async getAvarias() {
    return readMany('admin_avaria_items_view', {
      orderBy: 'item_updated_at',
      ascending: false,
      limit: 50,
    });
  },

  async getConferenciaRecebimentos() {
    return readMany('admin_conferencia_recebimentos_view', {
      orderBy: 'updated_at',
      ascending: false,
      limit: 30,
    });
  },

  async getConferenciaSaidas() {
    return readMany('admin_conferencia_saidas_view', {
      orderBy: 'updated_at',
      ascending: false,
      limit: 30,
    });
  },

  async getConferenciaBonusQueue() {
    return readMany('admin_conferencia_bonus_queue_view', {
      orderBy: 'created_at',
      ascending: false,
      limit: 50,
    });
  },

  async getPurchaseOrders() {
    return readMany('admin_purchase_orders_view', {
      orderBy: 'created_at',
      ascending: false,
      limit: 80,
    });
  },

  async getPurchaseOrderActions() {
    return readMany('admin_purchase_order_actions_view', {
      orderBy: 'created_at',
      ascending: false,
      limit: 80,
    });
  },

  async createPurchaseOrderFromXml(parsedXml, createdBy) {
    const items = Array.isArray(parsedXml?.items) ? parsedXml.items : [];

    return insertPurchaseOrderWithItems({
      createdBy,
      items,
      orderInput: {
        source_type: 'xml_nf',
        supplier_name: parsedXml.supplier_name,
        supplier_code: parsedXml.supplier_code || null,
        supplier_document: parsedXml.supplier_document || null,
        invoice_number: parsedXml.invoice_number,
        invoice_key: parsedXml.invoice_key || null,
        issued_at: parsedXml.issued_at || null,
        xml_payload: parsedXml.imported_payload || {},
        extra: {
          imported_from: 'xml',
        },
      },
    });
  },

  async createManualPurchaseOrder(orderInput, items, createdBy) {
    return insertPurchaseOrderWithItems({
      createdBy,
      items,
      orderInput: {
        ...orderInput,
        source_type: 'manual',
        extra: {
          source: 'manual',
          ...(orderInput.extra || {}),
        },
      },
    });
  },

  async importConferenciaBonusFromXml(queueInput, items, importedBy) {
    await ensureOpenQueueDoesNotExist(queueInput.invoice_number);

    const { data: queueRow, error: queueError } = await supabase
      .from('conferencia_bonus_queue')
      .insert([
        {
          source_type: queueInput.source_type || 'xml_nf',
          invoice_key: queueInput.invoice_key || null,
          invoice_number: queueInput.invoice_number,
          supplier_name: queueInput.supplier_name,
          supplier_code: queueInput.supplier_code || null,
          supplier_document: queueInput.supplier_document || null,
          issued_at: queueInput.issued_at || null,
          item_count: Number(queueInput.item_count || items.length),
          total_quantity: Number(queueInput.total_quantity || 0),
          status: 'nao_iniciado',
          imported_by: importedBy || null,
          imported_payload: queueInput.imported_payload || {},
        },
      ])
      .select('*')
      .single();

    if (queueError) throw queueError;

    const payloadItems = (items || []).map((item) => ({
      queue_id: queueRow.id,
      line_number: Number(item.line_number || 0),
      code: item.code || null,
      ean: item.ean || null,
      dun: item.dun || null,
      description: item.description,
      unit: item.unit || null,
      expected_qty: Number(item.expected_qty || 0),
    }));

    const { error: itemsError } = await supabase
      .from('conferencia_bonus_queue_items')
      .insert(payloadItems);

    if (itemsError) throw itemsError;

    return queueRow;
  },

  async createManualConferenciaBonus(queueInput, items, importedBy) {
    const normalizedItems = (items || []).map((item, index) => ({
      ...item,
      line_number: Number(item.line_number || index + 1),
      expected_qty: Number(item.expected_qty || 0),
      packaging_options: Array.isArray(item.packaging_options) ? item.packaging_options : [],
    })).filter((item) => String(item.description || '').trim());

    if (!normalizedItems.length) {
      throw new Error('Adicione pelo menos um produto ao bônus.');
    }

    return this.importConferenciaBonusFromXml(
      {
        ...queueInput,
        source_type: 'manual',
        item_count: normalizedItems.length,
        total_quantity: normalizedItems.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0),
        imported_payload: {
          source: 'manual',
          items: normalizedItems,
          ...queueInput.imported_payload,
        },
      },
      normalizedItems,
      importedBy,
    );
  },

  async importConferenciaBonusFromRecebimento(recebimentoRow, importedBy) {
    const payload = recebimentoRow?.payload || {};
    const payloadItems = Array.isArray(payload.items) ? payload.items : [];

    if (!payloadItems.length) {
      throw new Error('Esse recebimento não possui itens para gerar bônus.');
    }

    const invoiceNumber = String(recebimentoRow?.invoice || payload.invoice || '').trim();
    const supplierName = String(recebimentoRow?.supplier || payload.supplier || '').trim();

    if (!invoiceNumber) {
      throw new Error('Esse recebimento não possui NF informada.');
    }

    if (!supplierName) {
      throw new Error('Esse recebimento não possui fornecedor informado.');
    }

    const items = payloadItems.map(toBonusQueueItem);
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0);

    return this.importConferenciaBonusFromXml(
      {
        invoice_number: invoiceNumber,
        invoice_key: payload.invoiceKey || payload.invoice_key || null,
        supplier_name: supplierName,
        supplier_code: payload.supplierCode || payload.supplier_code || null,
        supplier_document: payload.supplierDocument || payload.supplier_document || null,
        issued_at: payload.createdAt || recebimentoRow?.created_at || null,
        item_count: items.length,
        total_quantity: totalQuantity,
        imported_payload: {
          ...payload,
          source: 'recebimento',
          source_recebimento_id: recebimentoRow?.id || null,
          items,
        },
      },
      items,
      importedBy,
    );
  },

  async markPurchaseOrderEntry(orderId, actorUserId) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'entrada_realizada',
        entry_status: 'realizada',
        entry_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao registrar a entrada do pedido.');
    }

    await insertPurchaseOrderAction({
      orderId,
      createdBy: actorUserId,
      actionType: 'entrada_realizada',
      actionLabel: 'Entrada realizada',
      payload: {
        status: data.status,
        entry_status: data.entry_status,
        entry_at: data.entry_at,
      },
    });

    return data;
  },

  async generateConferenciaBonusFromPurchaseOrder(orderId, importedBy) {
    const [{ data: orderRow, error: orderError }, { data: orderItems, error: itemsError }] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .single(),
      supabase
        .from('purchase_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('line_number', { ascending: true }),
    ]);

    if (orderError) {
      throw new Error(orderError.message || 'Falha ao carregar o pedido.');
    }

    if (itemsError) {
      throw new Error(itemsError.message || 'Falha ao carregar os itens do pedido.');
    }

    const bonusItems = (orderItems || []).map((item, index) => ({
      line_number: Number(item.line_number || index + 1),
      code: item.code || null,
      ean: item.ean || null,
      dun: item.dun || null,
      description: item.description,
      unit: item.unit || 'UN',
      expected_qty: Number(item.expected_qty || 0),
      packaging_options: Array.isArray(item.packaging_options) ? item.packaging_options : [],
    }));

    await this.importConferenciaBonusFromXml(
      {
        source_type: 'purchase_order',
        invoice_number: orderRow.invoice_number || orderRow.order_number,
        invoice_key: orderRow.invoice_key || null,
        supplier_name: orderRow.supplier_name,
        supplier_code: orderRow.supplier_code || null,
        supplier_document: orderRow.supplier_document || null,
        issued_at: orderRow.issued_at || null,
        item_count: bonusItems.length,
        total_quantity: bonusItems.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0),
        imported_payload: {
          source: 'purchase_order',
          purchase_order_id: orderRow.id,
          purchase_order_number: orderRow.order_number,
          items: bonusItems,
        },
      },
      bonusItems,
      importedBy,
    );

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'bonus_gerado',
        bonus_status: 'gerado',
        bonus_generated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao atualizar o pedido após gerar bônus.');
    }

    await insertPurchaseOrderAction({
      orderId,
      createdBy: importedBy,
      actionType: 'bonus_gerado',
      actionLabel: 'Bônus gerado',
      payload: {
        invoice_number: data.invoice_number,
        bonus_generated_at: data.bonus_generated_at,
      },
    });

    return data;
  },

  async requestPurchaseOrderReturn(orderId, actorUserId) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'devolucao_pendente',
        return_status: 'pendente',
        return_requested_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao gerar devolução do pedido.');
    }

    await insertPurchaseOrderAction({
      orderId,
      createdBy: actorUserId,
      actionType: 'devolucao_pendente',
      actionLabel: 'Devolução solicitada',
      payload: {
        return_status: data.return_status,
        return_requested_at: data.return_requested_at,
      },
    });

    return data;
  },

  async registerPurchaseOrderReprint(orderId, actorUserId) {
    const { data: currentOrder, error: currentError } = await supabase
      .from('purchase_orders')
      .select('id, reprint_count')
      .eq('id', orderId)
      .single();

    if (currentError) {
      throw new Error(currentError.message || 'Falha ao carregar o pedido para reimpressão.');
    }

    const nextReprintCount = Number(currentOrder.reprint_count || 0) + 1;

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        reprint_count: nextReprintCount,
        last_reprint_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao registrar a reimpressão.');
    }

    await insertPurchaseOrderAction({
      orderId,
      createdBy: actorUserId,
      actionType: 'reimpressao',
      actionLabel: 'Reimpressão registrada',
      payload: {
        reprint_count: data.reprint_count,
        last_reprint_at: data.last_reprint_at,
      },
    });

    return data;
  },

  async auditPurchaseOrder(orderId, actorUserId) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'auditado',
        audit_status: 'revisado',
        audited_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao auditar o pedido.');
    }

    await insertPurchaseOrderAction({
      orderId,
      createdBy: actorUserId,
      actionType: 'auditoria',
      actionLabel: 'Auditoria registrada',
      payload: {
        audit_status: data.audit_status,
        audited_at: data.audited_at,
      },
    });

    return data;
  },

  async getEvents() {
    const rows = await readMany('operational_events', {
      columns: 'id, module, event_type, entity_type, entity_id, actor_name, order_ref, batch_ref, created_at, payload, user_id',
      orderBy: 'created_at',
      ascending: false,
      limit: 60,
    });
    return attachActor(rows);
  },

  async updateTratativa(id, patch) {
    const { data, error } = await supabase
      .from('recebimento_treatment_cases')
      .update({
        ...patch,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error('Falha ao atualizar a tratativa.');
    }

    return data;
  },

  async getTratativaById(id) {
    const { data, error } = await supabase
      .from('admin_tratativas_view')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error('Falha ao carregar os detalhes da tratativa.');
    }

    return data;
  },

  async resolveAvariaItem(id, payload) {
    const { data, error } = await supabase
      .from('avaria_items')
      .update({
        status: payload.item_status || 'resolved',
        resolution_type: payload.resolution_type,
        resolution_note: payload.observacao || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error('Falha ao resolver o item de avaria.');
    }

    return data;
  },

  async deleteAvariaItem(id) {
    const { error } = await supabase
      .from('avaria_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error('Falha ao remover o item de avaria.');
    }
  },

  async applyValidadeTreatment(id, payload) {
    const { data, error } = await supabase
      .from('validade_products')
      .update({
        treatment_type: payload.treatment_type,
        treatment_date: new Date().toISOString(),
        treatment_note: payload.observacao || null,
        status: payload.status || 'treated',
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error('Falha ao aplicar a tratativa de validade.');
    }

    return data;
  },

  async resolveValidadeItem(id) {
    const { data, error } = await supabase
      .from('validade_products')
      .update({
        // Enum canônico do domínio: active | treated | resolved
        // (antes gravava 'resolvida', que divergia do schema e do dashboard).
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error('Falha ao marcar o item de validade como resolvido.');
    }

    return data;
  },

  async assignConferenciaBonus(id, userId, assignedUserName = null) {
    const { data, error } = await supabase
      .from('conferencia_bonus_queue')
      .update({
        assigned_user_id: userId || null,
        assigned_user_name: assignedUserName || null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao atribuir o responsável do bônus.');
    }

    return data;
  },

  async removeConferenciaBonus(id) {
    const { error } = await supabase
      .from('conferencia_bonus_queue')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error('Falha ao remover o bônus da fila.');
    }
  },

  async forceSignOut(userId) {
    // RPC SECURITY DEFINER: a RLS owner-only bloqueia o admin de atualizar a
    // presença de outro usuário; a função valida is_admin_user() e retorna
    // quantas sessões foram encerradas (para a UI distinguir "sem sessão ativa").
    const { data, error } = await supabase.rpc('admin_force_sign_out', {
      target_user_id: userId,
    });

    if (error) {
      throw new Error('Falha ao forçar o logout do usuário.');
    }

    return data || 0;
  },

  async getUserEvents(userId, limit = 20) {
    const { data, error } = await supabase
      .from('operational_events')
      .select('id, module, event_type, entity_type, entity_id, actor_name, order_ref, batch_ref, created_at, payload, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('Falha ao carregar o histórico do usuário.');
    }

    return attachActor(data || []);
  },
};
