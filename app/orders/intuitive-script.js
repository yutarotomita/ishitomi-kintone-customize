(function () {
  'use strict';

  // =================================================================
  // --- 設定項目 ---
  // =================================================================
  const SUBTABLE_CODE = 'テーブル';
  const QUANTITY_CODE = '数値_数量';
  const UNIT_PRICE_CODE = '数値_単価';
  const ROW_AMOUNT_CODE = '金額';
  const SUBTOTAL_CODE = '伝票合計';
  const TAX_RATE_CODE = '消費税率';
  const TAX_AMOUNT_CODE = '消費税額';
  const GRAND_TOTAL_CODE = '税込合計';

  const SUGGEST_SOURCE_APP_ID = 2; // ★★★ 取引先マスタアプリのID
  const SUGGEST_LOOKUP_FIELD_CODE = 'ルックアップ_取引名'; // このフィールドの変更を監視
  const SUGGEST_SEARCH_TARGET_CODE = '文字列__1行_得意先名１'; // ★★★ 取引先マスタ側の検索対象フィールド
  const SUGGEST_SPACE_CODE = 'suggestion_space'; // ★★★ サジェスト表示用スペースの要素ID

  // =================================================================
  // --- 関数定義 ---
  // =================================================================

  const calculateAll = (record) => {
    // (この関数は変更ありません)
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
    record[SUBTOTAL_CODE].value = subtotal;
    record[TAX_AMOUNT_CODE].value = taxAmount;
    record[GRAND_TOTAL_CODE].value = grandTotal;
  };

  /**
   * (サジェスト機能) 検索を実行してサジェストを表示する関数
   */
  const fetchAndShowSuggestions = (keyword) => {
    const suggestionElement = kintone.app.record.getSpaceElement(SUGGEST_SPACE_CODE);
    if (!suggestionElement || !keyword) return;

    // スペース要素の親を基準にサジェストを表示
    suggestionElement.parentElement.style.position = 'relative';

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: SUGGEST_SOURCE_APP_ID,
      query: `${SUGGEST_SEARCH_TARGET_CODE} like "${keyword}" order by $id desc limit 10`,
      fields: [SUGGEST_SEARCH_TARGET_CODE]
    }).then(resp => {
      let suggestionsHtml = '<ul style="position:absolute; top:100%; left:0; right:0; list-style:none; margin:0; padding:5px; border:1px solid #e3e3e3; background-color:white; z-index:2000;">';
      if (resp.records.length > 0) {
        resp.records.forEach(record => {
          const suggestionText = record[SUGGEST_SEARCH_TARGET_CODE].value;
          suggestionsHtml += `<li class="suggestion-item" data-lookup-value="${suggestionText}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f1f1;">${suggestionText}</li>`;
        });
      } else {
        suggestionsHtml += '<li style="padding:8px 12px; color:#888;">候補が見つかりません</li>';
      }
      suggestionsHtml += '</ul>';
      suggestionElement.innerHTML = suggestionsHtml;

      document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const selectedValue = e.target.getAttribute('data-lookup-value');
          const record = kintone.app.record.get().record;
          record[SUGGEST_LOOKUP_FIELD_CODE].value = selectedValue;
          kintone.app.record.set({ record }); // レコードを更新してルックアップを実行
          suggestionElement.innerHTML = ''; // 候補を消す
        });
      });
    });
  };

  // =================================================================
  // --- kintone イベントハンドラ ---
  // =================================================================

  // --- ルックアップフィールドの変更イベント ---
  const eventsForLookup = [
    'app.record.create.change.' + SUGGEST_LOOKUP_FIELD_CODE,
    'app.record.edit.change.' + SUGGEST_LOOKUP_FIELD_CODE,
  ];
  kintone.events.on(eventsForLookup, (event) => {
    const keyword = event.changes.field.value;
    fetchAndShowSuggestions(keyword);
    return event;
  });

  // --- 計算用フィールドの変更イベント ---
  const eventsForCalc = [
    'app.record.create.show', 'app.record.edit.show',
    'app.record.create.change.' + QUANTITY_CODE, 'app.record.edit.change.' + QUANTITY_CODE,
    'app.record.create.change.' + UNIT_PRICE_CODE, 'app.record.edit.change.' + UNIT_PRICE_CODE,
    'app.record.create.change.' + TAX_RATE_CODE, 'app.record.edit.change.' + TAX_RATE_CODE,
    'app.record.create.change.' + SUBTABLE_CODE, 'app.record.edit.change.' + SUBTABLE_CODE,
  ];
  kintone.events.on(eventsForCalc, (event) => {
    calculateAll(event.record);
    return event;
  });

})();