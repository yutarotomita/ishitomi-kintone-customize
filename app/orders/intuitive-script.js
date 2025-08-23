(function() {
  'use strict';

  // --- 設定項目 ---
  const HISTORY_APP_ID = kintone.app.getId();
  const CUSTOMER_FIELD = 'ルックアップ_取引名';
  const SUBTABLE_CODE = 'テーブル';
  const TRIGGER_FIELD = '数値_シール発行有無';
  const CAROUSEL_SPACE_ID = 'history_display_space';

  /**
   * 履歴を取得してカルーセルを生成するメインの関数
   */
  const showHistoryCarousel = (record) => {
    const customerName = record[CUSTOMER_FIELD].value;
    const spaceEl = kintone.app.record.getSpaceElement(CAROUSEL_SPACE_ID);

    if (!spaceEl) return;
    if (!customerName) {
      spaceEl.innerHTML = '';
      return;
    }
    
    spaceEl.innerHTML = '履歴を検索中...';

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: HISTORY_APP_ID,
      query: `${CUSTOMER_FIELD} = "${customerName}" order by 作成日時 desc limit 50`,
    }).then(resp => {
      const history = processHistoryData(resp.records);
      buildAndShowCarousel(history, spaceEl);
    }).catch(err => {
      console.error(err);
      spaceEl.innerHTML = '<span style="color:red;">履歴の取得中にエラーが発生しました。</span>';
    });
  };

  /**
   * APIで取得したレコードから、重複を除いた最新の商品リストを作成する
   * ★★★ 変更点：単価と単価IDも保持するように修正 ★★★
   */
  const processHistoryData = (records) => {
    const productMap = new Map();
    records.forEach(record => {
      if (!record[SUBTABLE_CODE] || !record[SUBTABLE_CODE].value) return;
      record[SUBTABLE_CODE].value.forEach(row => {
        const item = row.value;
        const productCode = item.ルックアップ_商品番号.value;
        if (productCode && !productMap.has(productCode)) {
          productMap.set(productCode, {
            productCode: productCode,
            productName: item.文字列__1行_商品名.value,
            price: item.数値_単価.value, // 単価を保持
            priceId: item.ルックアップ_単価ID.value // 単価IDを保持
          });
        }
      });
    });
    return Array.from(productMap.values());
  };

/**
   * カルーセルのUIを組み立てて表示する
   * ★★★ この関数をまるごと置き換えてください ★★★
   */
  const buildAndShowCarousel = (historyData, spaceElement) => {
    // カルーセルのカードHTMLを生成
    let cardsHtml = '';
    if (historyData.length > 0) {
      historyData.forEach(item => {
        // 金額をフォーマット（例: 1000 -> 1,000）
        const formattedPrice = Number(item.price || 0).toLocaleString();

        cardsHtml += `
          <div class="history-product-card" 
            data-product-code="${item.productCode}" 
            data-product-name="${item.productName}"
            data-price="${item.price || ''}"
            data-price-id="${item.priceId || ''}"
          >
            <div class="product-name">${item.productName}</div>
            <div class="product-code">商品番号: ${item.productCode}</div>
            <div class="product-price">¥ ${formattedPrice}</div>
          </div>
        `;
      });
    } else {
      cardsHtml = '<p style="text-align:center; width:100%; color:#777;">この取引先の受注履歴はありません。</p>';
    }

    // (以降の処理は変更ありません)
    const carouselHtml = `
      <div class="history-carousel-container">
        <div class="history-carousel-header">受注履歴から商品を選択</div>
        <div class="history-carousel-viewport">
          <div class="history-carousel-track">${cardsHtml}</div>
        </div>
        <button class="carousel-nav-btn prev" style="display:none;">&lt;</button>
        <button class="carousel-nav-btn next">&gt;</button>
      </div>
    `;

    spaceElement.innerHTML = carouselHtml;
    
    const track = spaceElement.querySelector('.history-carousel-track');
    const cards = spaceElement.querySelectorAll('.history-product-card');
    const prevBtn = spaceElement.querySelector('.prev');
    const nextBtn = spaceElement.querySelector('.next');
    
    if (cards.length === 0) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    const cardWidth = 150 + 20; // カード幅150px + margin 20px
    let currentIndex = 0;

    const updateNavButtons = () => {
      prevBtn.style.display = currentIndex > 0 ? 'block' : 'none';
      nextBtn.style.display = currentIndex < cards.length - 1 ? 'block' : 'none';
    };

    const updatePosition = () => {
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
      updateNavButtons();
    };
    
    nextBtn.onclick = () => {
      if (currentIndex < cards.length - 1) {
        currentIndex++;
        updatePosition();
      }
    };
    
    prevBtn.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        updatePosition();
      }
    };

    cards.forEach(card => {
      card.onclick = e => addItemToSubtable(e.currentTarget.dataset);
    });
    
    updateNavButtons();
  };

  /**
   * 選択した商品をサブテーブルに新しい行として追加する
   * ★★★ 変更点：単価と単価IDもセットするように修正 ★★★
   */
  const addItemToSubtable = (itemData) => {
    const currentRecord = kintone.app.record.get();
    const subtable = currentRecord.record[SUBTABLE_CODE].value;
    const newRow = {
      value: {
        'ルックアップ_商品番号': { type: 'NUMBER', value: itemData.productCode, lookup: true },
        '文字列__1行_商品名':   { type: 'SINGLE_LINE_TEXT', value: itemData.productName },
        'ルックアップ_単価ID': { type: 'NUMBER', value: itemData.priceId, lookup: true },
        // --- その他のフィールド ---
        '数値_単価':         { type: 'NUMBER', value: null },
        '数値_数量':         { type: 'NUMBER', value: null },
        '文字列__1行__単位':   { type: 'SINGLE_LINE_TEXT', value: '' },
        '金額':            { type: 'CALC', value: null },
        '文字列__1行_摘要':   { type: 'SINGLE_LINE_TEXT', value: '' }
      }
    };
    subtable.push(newRow);
    kintone.app.record.set(currentRecord);
  };

  // --- kintone イベントハンドラ ---
  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + TRIGGER_FIELD,
    'app.record.edit.change.' + TRIGGER_FIELD
  ];

  kintone.events.on(events, (event) => {
    showHistoryCarousel(event.record);
    return event;
  });

})();
