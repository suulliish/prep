// Состояние тоста: одна строка сверху на ~2.6 сек.
export const toastState = $state({ text: '', id: 0 });
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, ms = 2600) {
  toastState.text = text; toastState.id++;
  clearTimeout(timer); timer = setTimeout(() => (toastState.text = ''), ms);
}
