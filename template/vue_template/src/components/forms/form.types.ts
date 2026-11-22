export interface FormItem {
  type:
    | "input"
    | "textarea"
    | "select"
    | "switch"
    | "radios"
    | "checks"
    | "date"
    | "datetime"
    | "date-range"
    | "datetime-range"
    | "custom";
  key: string;
  label: string;
  placeholder?: string;
  // Common
  /** 必填验证 */
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean | Function;
  activeClear?: boolean;
  // Input
  isPassword?: boolean;
  isNumber?: boolean;
  isEmail?: boolean;
  // Select
  isMulti?: boolean;
  activeSearch?: boolean;
  list?: DrpItem[];
}

export interface DrpItem {
  key?: string | number;
  value?: string | number | boolean;
  label: string;
}
