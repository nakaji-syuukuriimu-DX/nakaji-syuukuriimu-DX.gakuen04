'use strict'
// ===== 予約データ管理（sessionStorage） =====
const RES_KEY = 'reservations';    // 全予約データ
const SELECT_KEY = 'selectedSlot'; // 選択中の部屋・日付・時間

const MAX_PEOPLE = 9;

// 予約データ取得
function getReservations() {
  const data = sessionStorage.getItem(RES_KEY);
  return data ? JSON.parse(data) : {};
}

// 予約データ保存
function saveReservations(res) {
  sessionStorage.setItem(RES_KEY, JSON.stringify(res));
}

// 選択中のスロット保存
function setSelected(room, dateKey, timeSlot) {
  sessionStorage.setItem(
    SELECT_KEY,
    JSON.stringify({ room, dateKey, timeSlot })
  );
}

// 選択中のスロット取得
function getSelected() {
  const data = sessionStorage.getItem(SELECT_KEY);
  return data ? JSON.parse(data) : null;
}

// ===== 日付関連 =====

// 今日〜2日後までの3日分のDate配列
function getDateArray() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// 表示用: "7月2日" など
function formatDisplayDate(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// キー用: "2026-07-02"
function formatKeyDate(d) {
  return d.toISOString().slice(0, 10);
}

// ===== ICカード(仮)のユーザ情報 =====
const IC_USERS = {
  '1111': { name: '山田太郎', grade: '3年' },
  '2222': { name: '佐藤花子', grade: '2年' },
  '3333': { name: '大岩時生', grade: '3年' },
  '4444': { name: '古澤きな', grade: '3年' },
  // 必要に応じて追加
};

function findUserByIc(icId) {
  return IC_USERS[icId] || null;
}

// ===== DayAndTime(第2画面)の処理 =====

function initDayAndTime(room) {
  const table = document.querySelector('.hyou');
  if (!table) return;

  const dates = getDateArray();
  const dateKeys = dates.map(formatKeyDate);
  const reservations = getReservations();

  // ヘッダー行の書き換え（6月30日 → 今日〜2日後）
  const headerTr = table.querySelector('tr');
  if (headerTr) {
    const ths = headerTr.querySelectorAll('th');
    // 0,2,4番目が日付、1,3,5番目が「予約人数」
    dates.forEach((d, i) => {
      const dateTh = ths[i * 2];
      const countTh = ths[i * 2 + 1];
      if (dateTh) dateTh.textContent = formatDisplayDate(d);
      if (countTh) countTh.textContent = '予約人数';
    });
  }

  // 2行目以降: 時間帯リンク & 人数を予約データと連動させる
  const rows = table.querySelectorAll('tr');
  // 0行目はヘッダーなので1行目から
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // 各日付（3列分）
    for (let i = 0; i < 3; i++) {
      const timeCell = row.cells[i * 2];     // 時間帯セル
      const countCell = row.cells[i * 2 + 1]; // 人数セル
      if (!timeCell || !countCell) continue;

      const a = timeCell.querySelector('a');
      if (!a) continue;

      const timeSlot = a.textContent.trim();   // "5:00~6:00" など
      const dateKey = dateKeys[i];             // 該当日付キー

      const roomRes = reservations[room] || {};
      const dayRes = roomRes[dateKey] || {};
      const list = dayRes[timeSlot] || [];

      // 人数表示を現在の予約数に合わせる
      countCell.textContent = `${list.length}/${MAX_PEOPLE}`;

      // クリック時の動作を上書き（HTMLのhrefはそのままでもOK）
      a.addEventListener('click', function (e) {
        e.preventDefault();
        // 選択した部屋・日付・時間を保存
        setSelected(room, dateKey, timeSlot);
        // 部屋に応じて予約情報画面へ
        const target =
          room === 'room1' ? 'yoyaku1.html' : 'yoyaku2.html';
        location.href = target;
      });
    }
  }
}

// ===== yoyaku(第3画面)の処理 =====

// 予約を追加
function addReservation(room, dateKey, timeSlot, user, icId) {
  const reservations = getReservations();
  if (!reservations[room]) reservations[room] = {};
  if (!reservations[room][dateKey]) reservations[room][dateKey] = {};
  if (!reservations[room][dateKey][timeSlot]) {
    reservations[room][dateKey][timeSlot] = [];
  }

  const list = reservations[room][dateKey][timeSlot];

  if (list.length >= MAX_PEOPLE) {
    alert('この時間帯は満員です');
    return false;
  }

  list.push({
    id: Date.now(), // 簡易ID
    name: user.name,
    grade: user.grade,
    timeSlot,
    reservedAt: new Date().toISOString(),
    icId,
  });

  saveReservations(reservations);
  return true;
}

// 予約を取消
function cancelReservation(room, dateKey, timeSlot, id) {
  const reservations = getReservations();
  const roomRes = reservations[room];
  if (!roomRes) return;
  const dayRes = roomRes[dateKey];
  if (!dayRes) return;
  const list = dayRes[timeSlot];
  if (!list) return;

  dayRes[timeSlot] = list.filter((r) => r.id !== id);
  saveReservations(reservations);
}

// 予約表を描画（枠組みは変えずに中身だけ更新）
function renderReservationTable(room, dateKey, timeSlot) {
  const table = document.getElementById('table2');
  if (!table) return;

  const reservations = getReservations();
  const roomRes = reservations[room] || {};
  const dayRes = roomRes[dateKey] || {};
  const list = dayRes[timeSlot] || [];

  const rows = table.rows;

  // ① まず全セルを空にする（レイアウトは変えない）
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.cells.length; c++) {
      row.cells[c].innerHTML = '';
    }
  }

  // ② 左上のでかい四角（行0, 列0）に「日付＋時間」を表示
  if (rows.length > 0 && rows[0].cells.length > 0) {
    const bigCell = rows[0].cells[0]; // colspan="3" のセル
    bigCell.textContent = `${dateKey} ${timeSlot}`;
  }

  // ③ 予約データを表示
  //  - 左側4人：行1〜4 の左ブロック（列0,1,2）
  //  - 右側5人：行0〜4 の右ブロック
  //      * 行0だけ特別：右側3セルは cells[1], cells[2], cells[3]
  //      * 行1〜4：右側3セルは cells[3], cells[4], cells[5]
  const maxDisplay = Math.min(list.length, 9); // 最大9人

  for (let i = 0; i < maxDisplay; i++) {
    const rsv = list[i];

    let rowIndex;
    let nameCol;
    let dateCol;
    let deleteCol;

    if (i < 4) {
      // 0〜3人目（合計4人） → 左側（行1〜4）
      rowIndex = 1 + i;  // 1,2,3,4 行目
      nameCol = 0;
      dateCol = 1;
      deleteCol = 2;
    } else {
      // 4〜8人目（合計5人） → 右側（行0〜4）
      const j = i - 4;   // 0〜4
      rowIndex = j;      // 行0〜4

      if (rowIndex === 0) {
        // 1行目（右上3マス）は cells[1], cells[2], cells[3]
        nameCol = 1;
        dateCol = 2;
        deleteCol = 3;
      } else {
        // 2〜5行目の右側3マスは cells[3], cells[4], cells[5]
        nameCol = 3;
        dateCol = 4;
        deleteCol = 5;
      }
    }

    const row = rows[rowIndex];
    if (!row) break;
    const cells = row.cells;
    if (cells.length <= deleteCol) continue;

    // 名前
    cells[nameCol].textContent = rsv.name;

    // 日付（選択した日付をそのまま表示）
    cells[dateCol].textContent = dateKey;

    // 削除ボタン
    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.dataset.id = rsv.id;

    cells[deleteCol].innerHTML = '';
    cells[deleteCol].appendChild(btn);

    // 削除ボタンの動作
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      cancelReservation(room, dateKey, timeSlot, id);
      renderReservationTable(room, dateKey, timeSlot);
    });
  }
}

// ICカード入力フォームを動的に追加
function createIcInputArea(room, dateKey, timeSlot) {
  const table = document.getElementById('table2');
  if (!table) return;

  const div = document.createElement('div');
  div.style.margin = '20px';
  div.innerHTML = `
    ICカードID(仮):
    <input type="text" id="icCardInput">
    <button id="reserveBtn">予約する</button>
  `;
  // table の前に挿入
  table.parentNode.insertBefore(div, table);

  const icInput = div.querySelector('#icCardInput');
  const reserveBtn = div.querySelector('#reserveBtn');

  reserveBtn.addEventListener('click', () => {
    const icId = icInput.value.trim();
    if (!icId) {
      alert('ICカードIDを入力してください(仮)。');
      return;
    }
    const user = findUserByIc(icId);
    if (!user) {
      alert('このICカードは登録されていません(仮)。');
      return;
    }

    const ok = addReservation(room, dateKey, timeSlot, user, icId);
    if (ok) {
      renderReservationTable(room, dateKey, timeSlot);
      icInput.value = '';
    }
  });
}

// 予約ページ初期化
function initReservationPage() {
  const selected = getSelected();
  if (!selected) {
    alert('日付と時間が選択されていません。');
    // とりあえずホームへ戻す
    location.href = 'index.html';
    return;
  }
  const { room, dateKey, timeSlot } = selected;

  // タイトルを書き換え（トレーニングルームx → 1/2）
  const h1 = document.querySelector('h1');
  if (h1) {
    const roomNum = room === 'room1' ? '1' : '2';
    h1.textContent =
      `トレーニングルーム${roomNum}予約状況 `;
  }

  // ICカード入力欄追加
  createIcInputArea(room, dateKey, timeSlot);

  // 予約一覧表示
  renderReservationTable(room, dateKey, timeSlot);
}

// ===== ページごとの起動 =====
document.addEventListener('DOMContentLoaded', () => {
  const page = location.pathname.split('/').pop();

  if (page === 'DayAndTime.html') {
    // ルーム1
    initDayAndTime('room1');
  } else if (page === 'DayAndTime2.html') {
    // ルーム2
    initDayAndTime('room2');
  } else if (page === 'yoyaku1.html' || page === 'yoyaku2.html') {
    // 予約情報画面
    initReservationPage();
  }
});