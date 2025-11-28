import React, { useState } from 'react';
import DocumentViewerModal from '../../../src/components/DocumentViewerModal/DocumentViewerModal';

export default {
  title: 'Components/Modals/Document Viewer',
  component: DocumentViewerModal,
  parameters: {
    layout: 'fullscreen',
  },
};

const Template = (args) => {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          padding: '10px 20px',
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Open Document Viewer
      </button>
      <DocumentViewerModal
        {...args}
        show={show}
        onClose={() => setShow(false)}
      />
    </>
  );
};

export const PDFDocument = Template.bind({});
PDFDocument.args = {
  documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  fileName: 'sample-document.pdf',
  mimeType: 'application/pdf',
  title: 'Sample PDF Document'
};

export const DOCXDocument = Template.bind({});
DOCXDocument.args = {
  documentUrl: 'https://file-examples.com/storage/fe8c7e0e7f62ab9d39e0c0e/2017/02/file-sample_100kB.docx',
  fileName: 'sample-document.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  title: 'Sample Word Document'
};

export const TextDocument = Template.bind({});
TextDocument.args = {
  documentUrl: 'https://www.w3.org/TR/PNG/iso_8859-1.txt',
  fileName: 'sample-text.txt',
  mimeType: 'text/plain',
  title: 'Sample Text Document'
};

export const UnsupportedDocument = Template.bind({});
UnsupportedDocument.args = {
  documentUrl: 'https://file-examples.com/storage/fe8c7e0e7f62ab9d39e0c0e/2017/10/file_example_XLSX_10.xlsx',
  fileName: 'sample-spreadsheet.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  title: 'Unsupported Document Type'
};

export const WithCustomDownload = Template.bind({});
WithCustomDownload.args = {
  documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  fileName: 'sample-document.pdf',
  mimeType: 'application/pdf',
  title: 'PDF with Custom Download',
  onDownload: (url, fileName) => {
    console.log('Custom download handler:', { url, fileName });
    alert(`Custom download: ${fileName}`);
  }
};

export const LoadingState = () => {
  const [show, setShow] = useState(true);

  return (
    <DocumentViewerModal
      show={show}
      onClose={() => setShow(false)}
      documentUrl="https://httpbin.org/delay/5" // Slow loading URL
      fileName="slow-loading.pdf"
      mimeType="application/pdf"
    />
  );
};

export const ErrorState = Template.bind({});
ErrorState.args = {
  documentUrl: 'https://invalid-url-that-does-not-exist.com/document.pdf',
  fileName: 'non-existent.pdf',
  mimeType: 'application/pdf',
  title: 'Document Load Error'
};