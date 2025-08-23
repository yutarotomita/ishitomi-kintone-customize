(async function() {
  'use strict';

  // --- 設定項目 ---
  const LINK_SPACE_ID = 'link_unitprice_add'; // リンクを表示するスペースの要素ID
  const DEV_UNITPRICE_APP_ID = 7
  const PROD_UNITPRICE_APP_ID = 17
  const DOMAIN_OBJ = await kintone.getDomain();
  const UNITPRICE_APP_ID = DOMAIN_OBJ.subdomain == 'k4lm2zcoq0sy' ? PROD_UNITPRICE_APP_ID : DEV_UNITPRICE_APP_ID;
  const UNIT_PRICE_APP_PATH = '/k/' + UNITPRICE_APP_ID + '/edit'; // 単価マスタの新規登録画面のパス

  /**
   * スペースにリンクを設置する関数
   */
  const createLink = () => {
    const spaceEl = kintone.app.record.getSpaceElement(LINK_SPACE_ID);

    // スペース要素が見つからない場合や、リンクが既に追加されている場合は何もしない
    if (!spaceEl || spaceEl.querySelector('.custom-link-to-unit-price')) {
      return;
    }

    // リンク要素(<a>タグ)を作成
    const link = document.createElement('a');
    link.href = UNIT_PRICE_APP_PATH;
    link.target = '_blank'; // 新しいタブで開くための設定
    link.innerText = '単価を新規登録する ＞';
    link.className = 'custom-link-to-unit-price'; // 追加済みかどうかの目印

    // 見た目を少し整える
    link.style.textDecoration = 'none';
    link.style.fontWeight = 'bold';

    // スペースに作成したリンクを追加
    spaceEl.appendChild(link);
  };

  // --- kintone イベントハンドラ ---
  const events = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(events, (event) => {
    createLink();
    return event;
  });

})();
