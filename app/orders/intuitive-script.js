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
  const SUGGEST_SOURCE_APP_ID = 2; // ★★★【重要】あなたの取引先マスタアプリのIDに変更してください ★★★
  const SUGGEST_LOOKUP_FIELD_CODE = 'ルックアップ_取引名'; // サジェスト機能を使うルックアップフィールド
  const SUGGEST_SEARCH_TARGET_CODE = '文字列__1行_得意先名１'; // ★★★ 検索対象のフィールドコード（取引先マスタ側）に変更してください ★★★

  // --- ③ UI調整用のフィールドコード ---
  const CUSTOMER_NAME_CODE = 'ルックアップ_取引名';

  // =================================================================
  // --- グローバル変数 ---
  // =================================================================
  let typingTimer;
  let suggestionContainer; // サジェスト表示用のDIV要素を保持する変数

  // =================================================================
  // --- 関数定義 ---
  // =================================================================

  // (計算機能) ... 変更なし ...
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

  // (UI調整) ... 変更なし ...
  const applyModernUI = () => {
    const customerField = kintone.app.record.getFieldElement(CUSTOMER_NAME_CODE);
    if (customerField) customerField.closest('.field-SgCtJMMM').classList.add('custom-customer-name', 'custom-header-area');
    const grandTotalField = kintone.app.record.getFieldElement(GRAND_TOTAL_CODE);
    if (grandTotalField) grandTotalField.closest('.field-SgCtJMMM').classList.add('custom-grand-total');
    const subtotalField = kintone.app.record.getFieldElement(SUBTOTAL_CODE);
    if (subtotalField) {
      const summaryArea = subtotalField.closest('.field-SgCtJMMM').parentElement;
      if (summaryArea) summaryArea.classList.add('custom-summary-area');
    }
  };

  /**
   * (サジェスト機能) 検索を実行してサジェストを表示する関数
   */
  const fetchAndShowSuggestions = (keyword, container) => {
    if (!keyword) {
      container.style.display = 'none';
      return;
    }
    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: SUGGEST_SOURCE_APP_ID,
      query: `${SUGGEST_SEARCH_TARGET_CODE} like "${keyword}" order by $id desc limit 10`,
      fields: [SUGGEST_SEARCH_TARGET_CODE]
    }).then(resp => {
      let suggestionsHtml = '';
      if (resp.records.length > 0) {
        resp.records.forEach(record => {
          const suggestionText = record[SUGGEST_SEARCH_TARGET_CODE].value;
          suggestionsHtml += `<li class="suggestion-item" data-lookup-value="${suggestionText}">${suggestionText}</li>`;
        });
      } else {
        suggestionsHtml += '<li class="suggestion-item-none">候補が見つかりません</li>';
      }
      container.innerHTML = `<ul>${suggestionsHtml}</ul>`;
      container.style.display = 'block';

      // 候補クリック時のイベント設定
      document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const selectedValue = e.target.getAttribute('data-lookup-value');
          const record = kintone.app.record.get().record;
          record[SUGGEST_LOOKUP_FIELD_CODE].value = selectedValue;
          kintone.app.record.set({ record });
          container.style.display = 'none';
        });
      });
    }).catch(err => {
      console.error('サジェスト機能でエラーが発生しました:', err);
      container.innerHTML = '<ul><li class="suggestion-item-error">検索エラー</li></ul>';
      container.style.display = 'block';
    });
  };

  /**
   * (サジェスト機能) サジェスト表示用の要素を作成・セットアップする関数
   */
  const setupSuggestionFeature = () => {
    const lookupFieldElement = kintone.app.record.getFieldElement(SUGGEST_LOOKUP_FIELD_CODE);
    if (!lookupFieldElement) {
      console.log('サジェスト用のルックアップフィールドが見つかりません。');
      return;
    }

    // ルックアップフィールド内の入力ボックスを取得
    const inputElement = lookupFieldElement.querySelector('input[type="text"]');
    if (!inputElement) {
      console.log('ルックアップ内の入力ボックスが見つかりません。');
      return;
    }

    // サジェスト表示用のDIVを一度だけ作成
    if (!suggestionContainer) {
      suggestionContainer = document.createElement('div');
      suggestionContainer.id = 'custom-suggestion-container';
      // スタイルを直接設定
      suggestionContainer.style.position = 'absolute';
      suggestionContainer.style.border = '1px solid #e3e3e3';
      suggestionContainer.style.backgroundColor = 'white';
      suggestionContainer.style.zIndex = '2000'; // 他の要素より手前に表示
      suggestionContainer.style.display = 'none'; // 初期状態は非表示
      suggestionContainer.style.listStyle = 'none';
      suggestionContainer.style.margin = '0';
      suggestionContainer.style.padding = '0';
      // CSSで細かいスタイルを指定したい場合は以下のようにクラスを付与
      // suggestionContainer.className = 'my-suggestion-box';

      document.body.appendChild(suggestionContainer);

      // 他の場所をクリックしたらサジェストを閉じる
      document.addEventListener('click', (e) => {
        if (!lookupFieldElement.contains(e.target)) {
          suggestionContainer.style.display = 'none';
        }
      });
    }

    // 入力ボックスのキー入力イベント
    inputElement.addEventListener('keyup', () => {
      // 位置とサイズを調整
      const rect = inputElement.getBoundingClientRect();
      suggestionContainer.style.top = `${rect.bottom + window.scrollY}px`;
      suggestionContainer.style.left = `${rect.left + window.scrollX}px`;
      suggestionContainer.style.width = `${rect.width}px`;
      
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        fetchAndShowSuggestions(inputElement.value, suggestionContainer);
      }, 500);
    });
  };

  // =================================================================
  // --- kintone イベントハンドラ ---
  // =================================================================
  const eventsOnEdit = [
    'app.record.create.show', 'app.record.edit.show',
    'app.record.create.change.' + QUANTITY_CODE, 'app.record.edit.change.' + QUANTITY_CODE,
    'app.record.create.change.' + UNIT_PRICE_CODE, 'app.record.edit.change.' + UNIT_PRICE_CODE,
    'app.record.create.change.' + TAX_RATE_CODE, 'app.record.edit.change.' + TAX_RATE_CODE,
    'app.record.create.change.' + SUBTABLE_CODE, 'app.record.edit.change.' + SUBTABLE_CODE,
  ];

  kintone.events.on(eventsOnEdit, (event) => {
    if (event.type.endsWith('.show')) {
      applyModernUI();
      setupSuggestionFeature(); // ★★★ 新しいサジェスト機能のセットアップを実行
    }
    calculateAll(event.record);
    return event;
  });

  kintone.events.on('app.record.detail.show', (event) => {
    applyModernUI();
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, false);
    kintone.app.record.setFieldShown(ROW_AMOUNT_CODE, true);
    return event;
  });
})();