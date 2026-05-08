import { ReactNode } from "react";
import { Root, createRoot } from "react-dom/client";

/**
 * Вспомогательная функция, предназначенная для отображения передаваемой разметки.
 *
 * Эту функцию можно использовать для рендеринга React компонентов в определенном контейнере.
 *
 * @param element Вставляемая разметка.
 * @param container HTML элемент, в котором будет отображаться разметка.
 * @returns Функцию для размонтирования (unmount) отображаемой разметки.
 */
export function render(
  element: ReactNode,
  container: Element | null
): () => void {
  if (!container) {
    console.warn("Не задан контейнер для функции render", element);
    return () => {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyContainer = container as any;

  if (anyContainer.timeout) {
    clearTimeout(anyContainer.timeout);
    anyContainer.timeout = undefined;
  }

  const createdRoot: Root = anyContainer.reactRoot ?? createRoot(container);

  anyContainer.reactRoot = createdRoot;

  createdRoot.render(element);

  return () => {
    anyContainer.timeout = setTimeout(() => {
      createdRoot.unmount();

      anyContainer.reactRoot = undefined;
      anyContainer.timeout = undefined;
    }, 0);
  };
}
