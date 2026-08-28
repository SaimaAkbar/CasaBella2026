import './SearchBar.css';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
}: SearchBarProps) {
  return (
    <label className="search-bar">
      <span className="search-bar__icon" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
    </label>
  );
}
