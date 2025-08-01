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

  // =================================================================
  // --- グローバル変数 ---
  // =================================================================
  let suggestionContainer; // サジェスト表示用のDIV要素を保持するグローバル変数

  // =================================================================
  // --- 関数定義 ---
  // =================================================================
  const calculateAll = (record) => { /* 変更なし */ };
  const applyModernUI = () => { /* 変更なし */ };

  /**
   * (サジェスト機能) 検索を実行してサジェストを表示する関数
   */
  const fetchAndShowSuggestions = (keyword, targetFieldElement) => {
    if (!keyword) {
      if (suggestionContainer) suggestionContainer.style.display = 'none';
      return;
    }

    // サジェスト表示用の箱（DIV）がなければ作成する
    if (!suggestionContainer) {
      suggestionContainer = document.createElement('div');
      suggestionContainer.id = 'dynamic-suggestion-container';
      suggestionContainer.style.cssText = 'position:absolute; border:1px solid #e3e3e3; background-color:white; z-index:2000; display:none; list-style:none; margin:0; padding:0;';
      document.body.appendChild(suggestionContainer);

      // 他の場所をクリックしたらサジェストを閉じる
      document.addEventListener('click', (e) => {
        if (suggestionContainer && !targetFieldElement.contains(e.target)) {
          suggestionContainer.style.display = 'none';
        }
      });
    }

    // サジェストボックスの位置をルックアップフィールドに合わせる
    const rect = targetFieldElement.getBoundingClientRect();
    suggestionContainer.style.top = `${rect.bottom + window.scrollY}px`;
    suggestionContainer.style.left = `${rect.left + window.scrollX}px`;
    suggestionContainer.style.width = `${rect.width}px`;
    
    // APIで候補を検索
    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: SUGGEST_SOURCE_APP_ID,
      query: `${SUGGEST_SEARCH_TARGET_CODE} like "${keyword}" order by $id desc limit 10`,
      fields: [SUGGEST_SEARCH_TARGET_CODE]
    }).then(resp => {
      let suggestionsHtml = '';
      if (resp.records.length > 0) {
        resp.records.forEach(record => {
          const suggestionText = record[SUGGEST_SEARCH_TARGET_CODE].value;
          suggestionsHtml += `<li class="suggestion-item" data-lookup-value="${suggestionText}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f1f1;">${suggestionText}</li>`;
        });
      } else {
        suggestionsHtml += '<li style="padding:8px 12px; color:#888;">候補が見つかりません</li>';
      }
      suggestionContainer.innerHTML = `<ul style="margin:0; padding:0;">${suggestionsHtml}</ul>`;
      suggestionContainer.style.display = 'block';

      // 候補クリック時のイベント設定
      document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const selectedValue = e.target.getAttribute('data-lookup-value');
          const record = kintone.app.record.get().record;
          record[SUGGEST_LOOKUP_FIELD_CODE].value = selectedValue;
          kintone.app.record.set({ record });
          if (suggestionContainer) suggestionContainer.style.display = 'none';
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
    
    // ★★★ 唯一の課題：画面要素の特定 ★★★
    // eventオブジェクトからは要素を直接取得できないため、querySelectorで間接的に特定する
    // class名がfield-XXXX（ID形式）になることを利用
    const fieldElement = document.querySelector(`.field-${event.fieldId}`);

    if (fieldElement) {
      fetchAndShowSuggestions(keyword, fieldElement);
    }
    return event;
  });

  // --- 計算用フィールドのイベント ---
  const eventsForCalc = [
    'app.record.create.show', 'app.record.edit.show',
    'app.record.create.change.' + QUANTITY_CODE, 'app.record.edit.change.' + QUANTITY_CODE,
    // (以下、他の計算用フィールドのイベントは省略)
  ];
  kintone.events.on(eventsForCalc, (event) => {
    if (event.type.endsWith('.show')) {
        // applyModernUI(); // getFieldElementが使えないため、この関数は編集画面などでのみ有効
    }
    calculateAll(event.record);
    return event;
  });

})();