(function() {
  'use strict';

  // --- 設定項目 (変更なし) ---
  const SUBTABLE_CODE = 'テーブル';
  const QUANTITY_CODE = '数値_数量';
  const UNIT_PRICE_CODE = '数値_単価';
  const ROW_AMOUNT_CODE = '金額';
  const SUBTOTAL_CODE = '伝票合計';
  const TAX_RATE_CODE = '消費税率';
  const TAX_AMOUNT_CODE = '消費税額';
  const GRAND_TOTAL_CODE = '税込合計';
  const CUSTOMER_NAME_CODE = 'ルックアップ_取引名';

  /**
   * すべての金額を再計算する関数
   */
  const calculateAll = (record) => { // 引数でレコード情報を受け取る
    let subtotal = 0;
    const tableRows = record[SUBTABLE_CODE].value;

    tableRows.forEach(row => {
      const quantity = parseFloat(row.value[QUANTITY_CODE].value) || 0;
      const unitPrice = parseFloat(row.value[UNIT_PRICE_CODE].value) || 0;
      const rowAmount = quantity * unitPrice;

      row.value[ROW_AMOUNT_CODE].value = rowAmount;
      subtotal += rowAmount;
    });

    const taxRate = parseFloat(record[TAX_RATE_CODE].value) || 0;
    const taxAmount = Math.floor(subtotal * (taxRate / 100));
    const grandTotal = subtotal + taxAmount;

    // 引数で受け取ったrecordオブジェクトの値を直接更新する
    record[SUBTOTAL_CODE].value = subtotal;
    record[TAX_AMOUNT_CODE].value = taxAmount;
    record[GRAND_TOTAL_CODE].value = grandTotal;

    // ★★★ 修正点1: return文を削除 ★★★
    // この関数内でrecordオブジェクトを直接変更すればよいため、値を返す必要はありません。
  };

  /**
   * UIの見た目を調整する関数 (変更なし)
   */
  const applyModernUI = () => {
    const customerField = kintone.app.record.getFieldElement(CUSTOMER_NAME_CODE);
    if (customerField) customerField.closest('.field-SgCtJMMM').classList.add('custom-customer-name', 'custom-header-area');

    const grandTotalField = kintone.app.record.getFieldElement(GRAND_TOTAL_CODE);
    if (grandTotalField) grandTotalField.closest('.field-SgCtJMMM').classList.add('custom-grand-total');

    const subtotalField = kintone.app.record.getFieldElement(SUBTOTAL_CODE);
    if (subtotalField) {
      const summaryArea = subtotalField.closest('.field-SgCtJMMM').parentElement;
      if(summaryArea) summaryArea.classList.add('custom-summary-area');
    }
  };

  // レコード追加・編集画面で実行するイベント (変更なし)
  const eventsOnEdit = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + QUANTITY_CODE,
    'app.record.edit.change.' + QUANTITY_CODE,
    'app.record.create.change.' + UNIT_PRICE_CODE,
    'app.record.edit.change.' + UNIT_PRICE_CODE,
    'app.record.create.change.' + TAX_RATE_CODE,
    'app.record.edit.change.' + TAX_RATE_CODE,
    'app.record.create.change.' + SUBTABLE_CODE,
    'app.record.edit.change.' + SUBTABLE_CODE,
  ];

  kintone.events.on(eventsOnEdit, (event) => {
    if (event.type.endsWith('.show')) {
      applyModernUI();
    }
    
    // ★★★ 修正点2: event.record を使用 ★★★
    // kintone.app.record.get() の代わりに、引数の event.record を使います。
    const record = event.record;
    calculateAll(record);

    // 最後に event を return すると、record に加えた変更が画面に反映されます。
    return event;
  });

  // レコード詳細画面で実行するイベント (変更なし)
  kintone.events.on('app.record.detail.show', (event) => {
    applyModernUI();
    // 詳細画面では計算フィールドを読み取り専用に見せる
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, false);
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, true);
    return event;
  });

})();