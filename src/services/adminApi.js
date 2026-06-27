import { supabase } from '../lib/supabase';

// Relação inexistente (view ainda não migrada) — PostgREST não a acha no schema cache.
const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === 'PGRST205' || code === '42P01'
    || msg.includes('could not find the table')
    || msg.includes('schema cache');
};

const readMany = async (table, options = {}) => {
  const {
    columns = '*',
    orderBy,
    ascending = false,
    limit,
    optional = false,
  } = options;

  let query = supabase.from(table).select(columns);

  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    // Uma view ainda não migrada não pode derrubar o painel inteiro: degrada p/ vazio.
    if (optional && isMissingRelationError(error)) {
      console.warn(`[adminApi] Relação ausente (rode a migração do schema): ${table}. Retornando vazio.`, error.message);
      return [];
    }
    throw error;
  }
  return data || [];
};

// Migração gradual para o schema em português (briefing §7): tenta ler de uma
// view em português (colunas aliasadas de volta aos nomes internos via
// "interno:coluna_pt"); se a view não existe ou falta alguma coluna (migração
// 0006/0007 ainda não aplicada), cai para a view admin_*_view antiga. Seguro
// antes e depois de aplicar o SQL — nunca quebra silenciosamente.
const readPt = async ({ ptTable, select, orderBy, ascending = false, limit, fallback }) => {
  try {
    if (!supabase) throw new Error('no-client');
    let query = supabase.from(ptTable).select(select);
    if (orderBy) query = query.order(orderBy, { ascending });
    if (typeof limit === 'number') query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (ptError) {
    if (ptError?.message !== 'no-client') {
      console.warn(`[adminApi] view pt "${ptTable}" indisponível; usando ${fallback.table}.`, ptError?.message || '');
    }
    return readMany(fallback.table, fallback.options);
  }
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
    if (!supabase) {
      throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente (e refaça o deploy).');
    }
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
    const rows = await readPt({
      ptTable: 'sistema_resumo_dashboard',
      select: 'active_users:usuarios_ativos, open_tratativas:tratativas_abertas, active_validade_products:produtos_validade_ativos, open_avaria_batches:lotes_avaria_abertos, open_avaria_items:itens_avaria_abertos, open_bonus_queue:fila_bonus_aberta, pending_divergencias:divergencias_pendentes',
      limit: 1,
      fallback: { table: 'admin_dashboard_summary_view', options: { limit: 1 } },
    });
    return rows[0] || null;
  },

  async getActiveUsers() {
    return readPt({
      ptTable: 'usuarios_colaboradores_ativos',
      select: 'session_id:sessao_id, user_id:usuario_id, name:nome, email, device_label:dispositivo, platform:plataforma, app_version:versao_app, current_module:modulo_atual, current_screen:tela_atual, current_order_ref:pedido_atual, status:situacao, last_heartbeat_at:ultimo_heartbeat',
      orderBy: 'ultimo_heartbeat', ascending: false, limit: 40,
      fallback: { table: 'admin_active_users_view', options: { orderBy: 'last_heartbeat_at', ascending: false, limit: 40 } },
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
    return readPt({
      ptTable: 'recebimento_tratativas',
      select: 'user_id:usuario_id, user_name:nome_usuario, user_email:email_usuario, id, doc_number:numero_documento, supplier_code:codigo_fornecedor, origin_invoice_number:nf_origem, return_invoice_number:nf_devolucao, status:situacao, occurrence_type:tipo_ocorrencia, resolution_type:tipo_resolucao, affected_quantity:quantidade_afetada, expected_quantity:quantidade_esperada, received_quantity:quantidade_recebida, opened_at:aberta_em, closed_at:fechada_em, status_updated_at:situacao_atualizada_em, created_at:criado_em, updated_at:atualizado_em',
      orderBy: 'atualizado_em', ascending: false, limit: 50,
      fallback: { table: 'admin_tratativas_view', options: { orderBy: 'updated_at', ascending: false, limit: 50 } },
    });
  },

  async getValidade() {
    return readPt({
      ptTable: 'validade_produtos',
      select: 'user_id:usuario_id, user_name:nome_usuario, user_email:email_usuario, id, codprod:codigo_produto, codauxiliar:codigo_auxiliar, descricao, lote, validade:data_validade, quantidade, diasrestantes:dias_restantes, location:localizacao, status:situacao, treatment_type:tipo_tratativa, treatment_quantity:quantidade_tratada, treatment_date:data_tratativa, treatment_note:observacao_tratativa, image_path:caminho_imagem, created_at:criado_em, updated_at:atualizado_em',
      orderBy: 'atualizado_em', ascending: false, limit: 50,
      fallback: { table: 'admin_validade_products_view', options: { orderBy: 'updated_at', ascending: false, limit: 50 } },
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
    return readPt({
      ptTable: 'conferencia_saidas_pt',
      select: 'user_id:usuario_id, user_name:nome_usuario, user_email:email_usuario, id, order_code:codigo_pedido, separador, embalador, sync_status:situacao_sync, items_count:qtd_itens, divergences_count:qtd_divergencias, created_at:criado_em, updated_at:atualizado_em',
      orderBy: 'atualizado_em', ascending: false, limit: 30,
      fallback: { table: 'admin_conferencia_saidas_view', options: { orderBy: 'updated_at', ascending: false, limit: 30 } },
    });
  },

  async getConferenciaDivergencias() {
    return readPt({
      ptTable: 'conferencia_divergencias_pt',
      select: 'user_id:usuario_id, user_name:nome_usuario, user_email:email_usuario, id, source:origem, status:situacao, code:codigo, description:descricao, supplier:fornecedor, invoice:nf, order_code:codigo_pedido, expected_qty:quantidade_esperada, checked_qty:quantidade_conferida, diff:diferenca, created_at:criado_em, updated_at:atualizado_em',
      orderBy: 'criado_em', ascending: false, limit: 200,
      fallback: { table: 'admin_conferencia_divergencias_view', options: { orderBy: 'created_at', ascending: false, limit: 200, optional: true } },
    });
  },

  async getConferenciaBonusQueue() {
    return readPt({
      ptTable: 'conferencia_fila_entrada',
      select: 'id, invoice_number:numero_nf, supplier_name:nome_fornecedor, item_count:qtd_itens, total_quantity:quantidade_total, checked_quantity:quantidade_conferida, status:situacao, assigned_user_id:responsavel_id, assigned_user_name:responsavel_nome, started_at:iniciada_em, finished_at:finalizada_em, conference_result:resultado_conferencia, divergence_count:qtd_divergencias, finalized_with_pendency:finalizada_com_pendencia, created_at:criado_em',
      orderBy: 'criado_em', ascending: false, limit: 50,
      fallback: { table: 'admin_conferencia_bonus_queue_view', options: { orderBy: 'created_at', ascending: false, limit: 50 } },
    });
  },

  async getPurchaseOrders() {
    return readPt({
      ptTable: 'recebimento_notas_entrada',
      select: 'id, order_number:numero_pedido, source_type:tipo_origem, supplier_name:nome_fornecedor, supplier_code:codigo_fornecedor, supplier_document:documento_fornecedor, invoice_number:numero_nf, issued_at:emitida_em, status:situacao, entry_status:situacao_entrada, bonus_status:situacao_bonus, return_status:situacao_devolucao, audit_status:situacao_auditoria, item_count:qtd_itens, total_quantity:quantidade_total, reprint_count:qtd_reimpressoes, entry_at:entrada_em, audited_at:auditada_em, closed_at:fechada_em, created_by_name:criado_por_nome, created_at:criado_em, updated_at:atualizado_em',
      orderBy: 'criado_em', ascending: false, limit: 80,
      fallback: { table: 'admin_purchase_orders_view', options: { orderBy: 'created_at', ascending: false, limit: 80 } },
    });
  },

  async getPurchaseOrderActions() {
    return readPt({
      ptTable: 'recebimento_acoes_pedido',
      select: 'id, order_id:pedido_id, created_by_name:criado_por_nome, order_number:numero_pedido, invoice_number:numero_nf, supplier_name:nome_fornecedor, action_type:tipo_acao, action_label:rotulo_acao, notes:observacao, created_at:criado_em',
      orderBy: 'criado_em', ascending: false, limit: 80,
      fallback: { table: 'admin_purchase_order_actions_view', options: { orderBy: 'created_at', ascending: false, limit: 80 } },
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
    const rows = await readPt({
      ptTable: 'auditoria_eventos',
      select: 'id, user_id:usuario_id, module:modulo, event_type:tipo_evento, entity_type:tipo_entidade, entity_id:entidade_id, actor_name:nome_ator, order_ref:pedido_ref, batch_ref:lote_ref, payload:dados, created_at:criado_em',
      orderBy: 'criado_em', ascending: false, limit: 60,
      fallback: {
        table: 'operational_events',
        options: {
          columns: 'id, module, event_type, entity_type, entity_id, actor_name, order_ref, batch_ref, created_at, payload, user_id',
          orderBy: 'created_at', ascending: false, limit: 60,
        },
      },
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

  // Finaliza um bônus pelo painel mesmo sem conferência completa (override do
  // admin). Marca a pendência no imported_payload para rastreio, sem exigir
  // migração de schema.
  async finishConferenciaBonusWithPendency(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();

    if (readError) {
      throw new Error(readError.message || 'Falha ao carregar o bônus.');
    }

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const { data, error } = await supabase
      .from('conferencia_bonus_queue')
      .update({
        status: 'finalizada',
        finished_at: new Date().toISOString(),
        imported_payload: {
          ...basePayload,
          finalized_with_pendency: true,
          finalized_by_admin: actorUserId || null,
          finalized_by_admin_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao finalizar o bônus com pendência.');
    }

    return data;
  },

  // Reabre um bônus finalizado: volta para a fila (nao_iniciado) e reaparece
  // para o conferente no app. Limpa o marcador de pendência e os timestamps.
  async reopenConferenciaBonus(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();

    if (readError) {
      throw new Error(readError.message || 'Falha ao carregar o bônus.');
    }

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const { data, error } = await supabase
      .from('conferencia_bonus_queue')
      .update({
        status: 'nao_iniciado',
        started_at: null,
        finished_at: null,
        imported_payload: {
          ...basePayload,
          finalized_with_pendency: false,
          reopened_by_admin: actorUserId || null,
          reopened_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao reabrir o bônus.');
    }

    return data;
  },

  // Dá entrada num bônus finalizado: encerra o ciclo (entrada_realizada) e ele
  // some das listas (conferente e admin). Mantém o registro para auditoria.
  async markConferenciaBonusEntry(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();

    if (readError) {
      throw new Error(readError.message || 'Falha ao carregar o bônus.');
    }

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('conferencia_bonus_queue')
      .update({
        status: 'entrada_realizada',
        imported_payload: {
          ...basePayload,
          entry_done: true,
          entry_done_by: actorUserId || null,
          entry_done_at: nowIso,
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Falha ao dar entrada no bônus.');
    }

    // Se o bônus veio de um pedido de compra, encerra o pedido também (sai da
    // lista de pedidos ativos). Não falha o fluxo do bônus se o pedido der erro.
    const purchaseOrderId = basePayload?.purchase_order_id || null;
    if (purchaseOrderId) {
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'encerrado',
          entry_status: 'realizada',
          entry_at: nowIso,
          closed_at: nowIso,
        })
        .eq('id', purchaseOrderId);

      if (poError) {
        console.warn('Bônus encerrado, mas falhou ao encerrar o pedido vinculado:', poError.message);
      }
    }

    return data;
  },

  // ── Bônus de SAÍDA (conferência de expedição/pedido) — tabela separada ──
  async getConferenciaSaidaBonusQueue() {
    return readPt({
      ptTable: 'conferencia_fila_saida',
      select: 'id, order_code:codigo_pedido, customer_name:nome_cliente, customer_code:codigo_cliente, route_code:codigo_rota, carga_code:codigo_carga, item_count:qtd_itens, total_quantity:quantidade_total, checked_quantity:quantidade_conferida, status:situacao, assigned_user_id:responsavel_id, assigned_user_name:responsavel_nome, started_at:iniciada_em, finished_at:finalizada_em, conference_result:resultado_conferencia, divergence_count:qtd_divergencias, finalized_with_pendency:finalizada_com_pendencia, created_at:criado_em',
      orderBy: 'criado_em', ascending: false, limit: 50,
      fallback: { table: 'admin_conferencia_saida_bonus_queue_view', options: { orderBy: 'created_at', ascending: false, limit: 50 } },
    });
  },

  async createManualConferenciaSaidaBonus(queueInput, items, importedBy) {
    const orderCode = String(queueInput.order_code || '').trim();
    if (!orderCode) {
      throw new Error('Informe o código do pedido de saída.');
    }

    const normalizedItems = (items || []).map((item, index) => ({
      ...item,
      line_number: Number(item.line_number || index + 1),
      expected_qty: Number(item.expected_qty || 0),
      packaging_options: Array.isArray(item.packaging_options) ? item.packaging_options : [],
    })).filter((item) => String(item.description || '').trim());

    if (!normalizedItems.length) {
      throw new Error('Adicione pelo menos um produto ao bônus de saída.');
    }

    // Impede dois bônus de saída em aberto para o mesmo pedido.
    const existingOpen = await supabase
      .from('conferencia_saida_bonus_queue')
      .select('id, order_code, status')
      .eq('order_code', orderCode)
      .in('status', ['nao_iniciado', 'em_conferencia'])
      .maybeSingle();
    if (existingOpen.error) throw existingOpen.error;
    if (existingOpen.data) {
      throw new Error(`Já existe um bônus de saída em aberto para o pedido ${orderCode}.`);
    }

    const { data: queueRow, error: queueError } = await supabase
      .from('conferencia_saida_bonus_queue')
      .insert([
        {
          source_type: 'manual',
          order_code: orderCode,
          order_key: orderCode.toUpperCase(),
          carga_code: queueInput.carga_code || null,
          customer_name: queueInput.customer_name || null,
          customer_code: queueInput.customer_code || null,
          route_code: queueInput.route_code || null,
          item_count: normalizedItems.length,
          total_quantity: normalizedItems.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0),
          status: 'nao_iniciado',
          imported_by: importedBy || null,
          imported_payload: { source: 'manual', items: normalizedItems },
        },
      ])
      .select('*')
      .single();

    if (queueError) throw queueError;

    const payloadItems = normalizedItems.map((item) => ({
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
      .from('conferencia_saida_bonus_queue_items')
      .insert(payloadItems);

    if (itemsError) throw itemsError;

    return queueRow;
  },

  async assignConferenciaSaidaBonus(id, userId, assignedUserName = null) {
    const { data, error } = await supabase
      .from('conferencia_saida_bonus_queue')
      .update({
        assigned_user_id: userId || null,
        assigned_user_name: assignedUserName || null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message || 'Falha ao atribuir o responsável do bônus de saída.');
    return data;
  },

  async removeConferenciaSaidaBonus(id) {
    const { error } = await supabase
      .from('conferencia_saida_bonus_queue')
      .delete()
      .eq('id', id);

    if (error) throw new Error('Falha ao remover o bônus de saída da fila.');
  },

  async finishConferenciaSaidaBonusWithPendency(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_saida_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();
    if (readError) throw new Error(readError.message || 'Falha ao carregar o bônus.');

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const { data, error } = await supabase
      .from('conferencia_saida_bonus_queue')
      .update({
        status: 'finalizada',
        finished_at: new Date().toISOString(),
        imported_payload: {
          ...basePayload,
          finalized_with_pendency: true,
          finalized_by_admin: actorUserId || null,
          finalized_by_admin_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message || 'Falha ao finalizar o bônus de saída.');
    return data;
  },

  async reopenConferenciaSaidaBonus(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_saida_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();
    if (readError) throw new Error(readError.message || 'Falha ao carregar o bônus.');

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const { data, error } = await supabase
      .from('conferencia_saida_bonus_queue')
      .update({
        status: 'nao_iniciado',
        started_at: null,
        finished_at: null,
        imported_payload: {
          ...basePayload,
          finalized_with_pendency: false,
          reopened_by_admin: actorUserId || null,
          reopened_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message || 'Falha ao reabrir o bônus de saída.');
    return data;
  },

  // "Dar saída" = baixa/expedição do pedido conferido (status terminal).
  async markConferenciaSaidaBonusExit(id, actorUserId = null) {
    const { data: current, error: readError } = await supabase
      .from('conferencia_saida_bonus_queue')
      .select('imported_payload')
      .eq('id', id)
      .single();
    if (readError) throw new Error(readError.message || 'Falha ao carregar o bônus.');

    const basePayload = current?.imported_payload && typeof current.imported_payload === 'object'
      ? current.imported_payload
      : {};

    const { data, error } = await supabase
      .from('conferencia_saida_bonus_queue')
      .update({
        status: 'saida_realizada',
        imported_payload: {
          ...basePayload,
          exit_done: true,
          exit_done_by: actorUserId || null,
          exit_done_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message || 'Falha ao dar saída no bônus.');
    return data;
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

  // Gera URLs assinadas (bucket privado product-images) para os caminhos das
  // imagens de validade. Retorna um mapa { image_path: signedUrl }. Degrada para
  // {} se a política de leitura admin do storage ainda não foi aplicada
  // (docs/migrations/0003) — a UI mostra o placeholder nesse caso.
  async createSignedProductImageUrls(paths, expiresIn = 3600) {
    const clean = [...new Set((paths || []).filter(Boolean))];
    if (!clean.length) return {};
    try {
      const { data, error } = await supabase
        .storage
        .from('product-images')
        .createSignedUrls(clean, expiresIn);
      if (error) {
        console.warn('[adminApi] Sem acesso de leitura ao product-images (rode migrations/0003):', error.message);
        return {};
      }
      const map = {};
      (data || []).forEach((item) => {
        if (item?.signedUrl && !item.error) map[item.path] = item.signedUrl;
      });
      return map;
    } catch (storageError) {
      console.warn('[adminApi] Falha ao assinar imagens de produto:', storageError?.message);
      return {};
    }
  },
};
