(function () {
  'use strict';

  // =================================================================
  // --- 設定項目 ---
  // =================================================================

  // --- ① リアルタイム計算機能のフィールドコード ---
  const SUBTABLE_CODE = 'テーブル';
  const QUANTITY_CODE = '数値_数量';
  const UNIT_PRICE_CODE = '数値_単価';
  const ROW_AMOUNT_CODE = '金額';
  const SUBTOTAL_CODE = '伝票合計';
  const TAX_RATE_CODE = '消費税率';
  const TAX_AMOUNT_CODE = '消費税額';
  const GRAND_TOTAL_CODE = '税込合計';

  // --- ② リアルタイムサジェスト機能のフィールドコード ---
  const SUGGEST_SOURCE_APP_ID = 2; //取引先マスタアプリのID
  const SUGGEST_SEARCH_TEXT_CODE = 'customer_search'; // 検索キーワードを入力するフィールド
  const SUGGEST_SEARCH_TARGET_CODE = '文字列__1行_得意先名１'; // 検索したいフィールドコード
  const SUGGEST_LOOKUP_FIELD_CODE = 'ルックアップ_取引名'; // 検索結果を反映させるルックアップフィールド
  const SUGGEST_SPACE_CODE = 'suggestion_space'; // サジェストを表示するスペースフィールド

  // --- ③ UI調整用のフィールドコード ---
  const CUSTOMER_NAME_CODE = 'ルックアップ_取引名';


  // =================================================================
  // --- グローバル変数 ---
  // =================================================================
  let typingTimer; // サジェスト機能のタイマー


  // =================================================================
  // --- 関数定義 ---
  // =================================================================

  /**
   * (計算機能) すべての金額を再計算する関数
   */
  const calculateAll = (record) => {
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
   * (UI調整) モダンなUIを適用する関数
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

  /**
   * (サジェスト機能) 検索を実行してサジェストを表示する関数
   */
  const fetchAndShowSuggestions = (keyword) => {
    const suggestionElement = kintone.app.record.getSpaceElement(SUGGEST_SPACE_CODE);
    if (!suggestionElement) return;
    if (!keyword) {
      suggestionElement.innerHTML = '';
      return;
    }

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: SUGGEST_SOURCE_APP_ID,
      query: `${SUGGEST_SEARCH_TARGET_CODE} like "${keyword}" limit 10`,
      fields: [SUGGEST_SEARCH_TARGET_CODE, '$id']
    }).then(resp => {
      let suggestionsHtml = '<ul style="list-style:none; margin:0; padding:5px; border:1px solid #e3e3e3; background-color:white; position:absolute; z-index:10; width:100%;">';
      if (resp.records.length > 0) {
        resp.records.forEach(record => {
          const suggestionText = record[SUGGEST_SEARCH_TARGET_CODE].value;
          suggestionsHtml += `<li class="suggestion-item" data-lookup-value="${suggestionText}" style="padding:8px 12px; cursor:pointer; border-bottom: 1px solid #f1f1f1;">${suggestionText}</li>`;
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
          suggestionElement.innerHTML = '';
        });
      });
    }).catch(err => {
      console.error('Suggestion fetch error:', err);
      suggestionElement.innerHTML = '<div style="color:red; padding:8px;">検索エラー</div>';
    });
  };


  // =================================================================
  // --- kintone イベントハンドラ ---
  // =================================================================

  // --- レコード追加・編集画面のイベント ---
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
    // --- 画面表示時の処理 ---
    if (event.type.endsWith('.show')) {
      // ① UI調整を実行
      applyModernUI();

      // ② サジェスト機能の入力欄を設定
      const searchElement = kintone.app.record.getFieldElement(SUGGEST_SEARCH_TEXT_CODE);
      if (searchElement) {
        searchElement.style.position = 'relative'; // サジェスト表示位置の基準とする
        const inputElement = searchElement.querySelector('input');
        if (inputElement) {
          inputElement.addEventListener('keyup', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => fetchAndShowSuggestions(inputElement.value), 500);
          });
        }
      }
    }

    // --- フィールド変更時の処理 ---
    // ③ リアルタイム計算を実行
    calculateAll(event.record);

    return event;
  });

  // --- レコード詳細画面のイベント ---
  kintone.events.on('app.record.detail.show', (event) => {
    applyModernUI();
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, false);
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, true);
    return event;
  });

})();