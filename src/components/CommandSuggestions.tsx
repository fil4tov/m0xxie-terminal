import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

export function CommandSuggestions({
  open,
  scrollContainer,
  selected,
  children,
}: {
  open: boolean;
  scrollContainer: RefObject<HTMLDivElement | null>;
  selected: number;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const lastChildren = useRef(children);
  useLayoutEffect(() => {
    if (open) lastChildren.current = children;
  }, [open, children]);
  useLayoutEffect(() => {
    if (!menu.current || typeof ResizeObserver === "undefined") return;
    // Follow the changing menu height inside the chat, never the page.
    const observer = new ResizeObserver(() => {
      const chat = scrollContainer.current;
      if (chat) chat.scrollTop = chat.scrollHeight;
    });
    observer.observe(menu.current);
    return () => observer.disconnect();
  }, [scrollContainer]);
  useLayoutEffect(() => {
    if (!open) return;
    const list = menu.current?.querySelector<HTMLElement>("[role=listbox]");
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !option) return;
    // Keep keyboard selection visible without scrolling the page or chat.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, selected, children]);

  return (
    <div
      className="suggestions-collapse"
      ref={menu}
      data-open={open}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="suggestions-clip">
        <div className="command-suggestions">
          <div className="suggestions-caption" aria-hidden="true">
            <span>КОМАНДЫ</span>
            <span>↑ ↓ · Enter · Esc</span>
          </div>
          {open ? children : lastChildren.current}
        </div>
      </div>
    </div>
  );
}
