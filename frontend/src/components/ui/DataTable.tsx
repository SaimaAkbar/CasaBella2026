import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './DataTable.css';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  title?: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  freezeLeft?: number;
  renderAfterRow?: (row: T) => ReactNode;
  wrapClassName?: string;
  rowClassName?: (row: T) => string | undefined;
};

function columnClassName<T>(
  column: DataTableColumn<T>,
  index: number,
  freezeLeft: number,
) {
  const frozen = freezeLeft > 0 && index < freezeLeft;
  return [
    column.className,
    column.key === 'actions' ? 'data-table__col--actions' : '',
    frozen ? 'data-table__sticky-left' : '',
    frozen ? `data-table__sticky-left--${index}` : '',
    frozen && index === freezeLeft - 1 ? 'data-table__sticky-left--last' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  freezeLeft = 0,
  renderAfterRow,
  wrapClassName,
  rowClassName,
}: DataTableProps<T>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [leftOffsets, setLeftOffsets] = useState<number[]>([]);

  useLayoutEffect(() => {
    if (freezeLeft <= 0) {
      setLeftOffsets([]);
      return;
    }
    const table = tableRef.current;
    if (!table) return;

    const measure = () => {
      const cells = table.querySelectorAll('thead th');
      const next: number[] = [];
      let acc = 0;
      for (let i = 0; i < freezeLeft; i += 1) {
        next.push(acc);
        acc += (cells[i] as HTMLElement | undefined)?.offsetWidth ?? 0;
      }
      setLeftOffsets((prev) =>
        prev.length === next.length && prev.every((value, i) => value === next[i])
          ? prev
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [freezeLeft, columns, rows]);

  function stickyStyle(index: number): CSSProperties | undefined {
    if (freezeLeft <= 0 || index >= freezeLeft) return undefined;
    return { left: leftOffsets[index] ?? 0 };
  }

  return (
    <div className={['data-table-wrap', wrapClassName].filter(Boolean).join(' ')}>
      <table ref={tableRef} className="data-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                className={columnClassName(column, index, freezeLeft)}
                style={stickyStyle(index)}
                title={column.title ?? column.header}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const after = renderAfterRow?.(row);
            const extraClass = rowClassName?.(row);
            return (
              <Fragment key={rowKey(row)}>
                <tr className={extraClass || undefined}>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={columnClassName(column, index, freezeLeft)}
                      style={stickyStyle(index)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
                {after ? (
                  <tr className="data-table__after-row">
                    <td colSpan={columns.length}>{after}</td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
