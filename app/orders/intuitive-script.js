(function () {
  'use strict';

  // 確認したいフィールドコード
  const FIELD_CODE_TO_CHECK = 'ルックアップ_取引名';

  kintone.events.on('app.record.create.show', function(event) {
    
    console.log('--- 最終切り分けテスト ---');

    // 1. データオブジェクト内にフィールドが存在するか確認
    console.log('1. データとしての存在チェック:', event.record[FIELD_CODE_TO_CHECK]);

    // 2. 画面要素としてフィールドが存在するか確認
    console.log('2. 画面要素としての存在チェック:', kintone.app.record.getFieldElement(FIELD_CODE_TO_CHECK));

    if (event.record[FIELD_CODE_TO_CHECK] && !kintone.app.record.getFieldElement(FIELD_CODE_TO_CHECK)) {
      alert('【結論】\nデータは存在しますが、画面上にフィールドが見つかりません。\n\nアプリ設定の「フォーム」で、フィールドが正しく配置されているか確認してください。');
    }

    return event;
  });

})();