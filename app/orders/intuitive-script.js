(function() {
  'use strict';

  // --- 設定項目 ---
  // スキーマからフィールドコードを指定
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
  const calculateAll = (record) => {
    let subtotal = 0;
    const tableRows = record[SUBTABLE_CODE].value;

    // 1. 各行の金額を計算し、伝票合計を算出
    tableRows.forEach(row => {
      const quantity = parseFloat(row.value[QUANTITY_CODE].value) || 0;
      const unitPrice = parseFloat(row.value[UNIT_PRICE_CODE].value) || 0;
      const rowAmount = quantity * unitPrice;

      row.value[ROW_AMOUNT_CODE].value = rowAmount;
      subtotal += rowAmount;
    });

    // 2. 伝票合計、消費税額、税込合計を計算
    const taxRate = parseFloat(record[TAX_RATE_CODE].value) || 0;
    const taxAmount = Math.floor(subtotal * (taxRate / 100)); // スキーマのROUNDDOWNに合わせて切り捨て
    const grandTotal = subtotal + taxAmount;

    // 3. レコードの各フィールドに計算結果をセット
    record[SUBTOTAL_CODE].value = subtotal;
    record[TAX_AMOUNT_CODE].value = taxAmount;
    record[GRAND_TOTAL_CODE].value = grandTotal;

    return kintone.app.record.get(); // 更新されたレコードオブジェクトを返す
  };

  /**
   * UIの見た目を調整する関数
   */
  const applyModernUI = () => {
    // CSSでスタイリングするためのカスタムクラスを追加
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


  // レコード追加・編集画面で実行するイベント
  const eventsOnEdit = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + QUANTITY_CODE,
    'app.record.edit.change.' + QUANTITY_CODE,
    'app.record.create.change.' + UNIT_PRICE_CODE,
    'app.record.edit.change.' + UNIT_PRICE_CODE,
    'app.record.create.change.' + TAX_RATE_CODE,
    'app.record.edit.change.' + TAX_RATE_CODE,
    'app.record.create.change.' + SUBTABLE_CODE, // 行の追加・削除を検知
    'app.record.edit.change.' + SUBTABLE_CODE,
  ];

  kintone.events.on(eventsOnEdit, (event) => {
    // 画面表示時にUIを調整
    if (event.type.endsWith('.show')) {
      applyModernUI();
    }
    
    // フィールド値が変更されたらリアルタイム計算を実行
    const currentRecord = kintone.app.record.get().record;
    calculateAll(currentRecord);

    return event;
  });

  // レコード詳細画面で実行するイベント
  kintone.events.on('app.record.detail.show', (event) => {
    applyModernUI();
    // 詳細画面では計算フィールドを読み取り専用に見せる
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, false);
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, true);
    return event;
  });

})();