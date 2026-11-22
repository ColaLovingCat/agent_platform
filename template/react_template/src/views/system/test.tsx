import FileViewer, { type ViewerOptions } from '@file-viewer/react'
import { spreadsheetRenderer } from '@file-viewer/renderer-spreadsheet'

const options = {
  renderers: [spreadsheetRenderer] as unknown as ViewerOptions['renderers'],
  rendererMode: 'replace',
  theme: 'light',
  toolbar: { position: 'bottom-right' },
} satisfies ViewerOptions

const Preview = () => {
  return (
    <FileViewer
      url="/systems/lan/lang.xlsx"
      style={{ height: 900 }}
      options={options}
    />
  )
}

export default Preview
