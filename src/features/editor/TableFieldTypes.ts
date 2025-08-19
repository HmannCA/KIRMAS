export type TableColumn = {
  id: string
  key: string
  label: string
  type: 'text'|'number'|'select'|'checkbox'|'radio'
  options?: string[]
  required?: boolean
  min?: number
  max?: number
  pattern?: string
  /** Optional: feste Spaltenbreite in Prozent (0-100). Wenn weggelassen -> Auto. */
  widthPct?: number
}
export type TableRow = Record<string, any>
