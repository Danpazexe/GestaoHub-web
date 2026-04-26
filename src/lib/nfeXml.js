const parseXml = (xmlText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');

  if (parserError) {
    throw new Error('XML invalido.');
  }

  return doc;
};

const getFirstNode = (root, tagName) =>
  root.getElementsByTagName(tagName)[0] || root.getElementsByTagNameNS('*', tagName)[0] || null;

const getTagText = (root, tagName) => {
  const nodes = root.getElementsByTagName(tagName);
  if (nodes?.[0]?.textContent) {
    return String(nodes[0].textContent).trim();
  }

  const wildcardNodes = root.getElementsByTagNameNS('*', tagName);
  if (wildcardNodes?.[0]?.textContent) {
    return String(wildcardNodes[0].textContent).trim();
  }

  return '';
};

const getNodesByTagName = (root, tagName) => {
  const byTag = Array.from(root.getElementsByTagName(tagName));
  if (byTag.length > 0) {
    return byTag;
  }

  return Array.from(root.getElementsByTagNameNS('*', tagName));
};

const toIsoDate = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toNumber = (value) => {
  const normalized = String(value || '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundFactor = (value) => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= 0.0001 ? rounded : 1;
};

const buildPackagingOptions = ({
  useTribAsBase,
  commercialUnit,
  commercialEan,
  commercialQty,
  tributaryUnit,
  tributaryEan,
  tributaryQty,
}) => {
  const options = [];

  const pushOption = ({ id, label, factor, ean }) => {
    const normalizedLabel = String(label || '').trim();
    const normalizedEan = String(ean || '').trim();
    const normalizedFactor = Math.max(1, roundFactor(Number(factor) || 1));

    if (!normalizedLabel) return;
    if (options.some((option) => option.label === normalizedLabel && option.factor === normalizedFactor && option.ean === normalizedEan)) {
      return;
    }

    options.push({
      id,
      label: normalizedLabel,
      factor: normalizedFactor,
      ean: normalizedEan,
      dun: '',
    });
  };

  if (useTribAsBase) {
    pushOption({ id: 'trib', label: tributaryUnit, factor: 1, ean: tributaryEan });

    const ratio = commercialQty > 0 ? tributaryQty / commercialQty : 0;
    const commercialFactor = roundFactor(ratio);
    if (commercialFactor > 1) {
      pushOption({ id: 'com', label: commercialUnit, factor: commercialFactor, ean: commercialEan });
    }
  } else {
    pushOption({ id: 'com', label: commercialUnit || tributaryUnit || 'UN', factor: 1, ean: commercialEan || tributaryEan });
  }

  return options;
};

export const parseNfeXml = (xmlText) => {
  const doc = parseXml(xmlText);
  const infNfe = getFirstNode(doc, 'infNFe');

  if (!infNfe) {
    throw new Error('Nao foi encontrado o bloco infNFe no XML.');
  }

  const detNodes = getNodesByTagName(infNfe, 'det');

  const items = detNodes.map((detNode, index) => {
    const productNode = getFirstNode(detNode, 'prod');
    if (!productNode) return null;

    const commercialUnit = getTagText(productNode, 'uCom') || '';
    const tributaryUnit = getTagText(productNode, 'uTrib') || commercialUnit || '';
    const commercialQty = toNumber(getTagText(productNode, 'qCom'));
    const tributaryQty = toNumber(getTagText(productNode, 'qTrib')) || commercialQty;
    const commercialEan = getTagText(productNode, 'cEAN');
    const tributaryEan = getTagText(productNode, 'cEANTrib') || commercialEan;
    const ratio = commercialQty > 0 ? tributaryQty / commercialQty : 0;
    const useTribAsBase = tributaryQty > commercialQty && roundFactor(ratio) > 1;
    const packagingOptions = buildPackagingOptions({
      useTribAsBase,
      commercialUnit,
      commercialEan,
      commercialQty,
      tributaryUnit,
      tributaryEan,
      tributaryQty,
    });
    const lineNumber = Number(
      detNode.getAttribute('nItem')
        || getTagText(detNode, 'nItem')
        || index + 1,
    );

    return {
      line_number: lineNumber,
      code: getTagText(productNode, 'cProd'),
      ean: useTribAsBase ? (tributaryEan || commercialEan) : (commercialEan || tributaryEan),
      dun: '',
      description: getTagText(productNode, 'xProd'),
      unit: useTribAsBase ? (tributaryUnit || commercialUnit || 'UN') : (commercialUnit || tributaryUnit || 'UN'),
      expected_qty: useTribAsBase ? tributaryQty : (commercialQty || tributaryQty),
      commercial_unit: commercialUnit || null,
      commercial_qty: commercialQty,
      commercial_ean: commercialEan || null,
      tributary_unit: tributaryUnit || null,
      tributary_qty: tributaryQty,
      tributary_ean: tributaryEan || null,
      base_unit: useTribAsBase ? (tributaryUnit || commercialUnit || 'UN') : (commercialUnit || tributaryUnit || 'UN'),
      base_qty: useTribAsBase ? tributaryQty : (commercialQty || tributaryQty),
      packaging_options: packagingOptions,
    };
  }).filter((item) => item && item.description);

  const ideNode = getFirstNode(infNfe, 'ide');
  const emitNode = getFirstNode(infNfe, 'emit');

  const invoiceNumber = getTagText(ideNode || infNfe, 'nNF');
  const invoiceKey = String(infNfe.getAttribute('Id') || '').replace(/^NFe/, '');
  const supplierName = getTagText(emitNode || infNfe, 'xNome');
  const supplierDocument = getTagText(emitNode || infNfe, 'CNPJ') || getTagText(emitNode || infNfe, 'CPF');
  const issuedAt = toIsoDate(
    getTagText(ideNode || infNfe, 'dhEmi')
      || getTagText(ideNode || infNfe, 'dEmi'),
  );

  if (!invoiceNumber) {
    throw new Error('O XML nao possui numero de NF.');
  }

  if (!supplierName) {
    throw new Error('O XML nao possui emitente.');
  }

  if (items.length === 0) {
    throw new Error('O XML nao possui itens validos para conferencia.');
  }

  return {
    invoice_number: invoiceNumber,
    invoice_key: invoiceKey,
    supplier_name: supplierName,
    supplier_document: supplierDocument,
    issued_at: issuedAt,
    item_count: items.length,
    total_quantity: items.reduce((sum, item) => sum + Number(item.expected_qty || 0), 0),
    imported_payload: {
      invoiceNumber,
      invoiceKey,
      supplierName,
      supplierDocument,
      issuedAt,
      items,
    },
    items,
  };
};
