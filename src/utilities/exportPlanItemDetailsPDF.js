import { logger } from './logger';
import getDetailDisplayFields from '../components/PlanItemDetailsModal/getDetailDisplayFields';

const PRINT_STYLES = `
  @media print {
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .print-header { margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
    .print-title { font-size: 24px; font-weight: bold; margin: 0 0 8px 0; }
    .print-subtitle { font-size: 14px; color: #666; margin: 0; }
    .print-category { margin-bottom: 24px; }
    .print-category-title { font-size: 18px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
    .print-item { padding: 12px; margin-bottom: 8px; background: #f5f5f5; border-radius: 8px; }
    .print-item-type { font-size: 12px; color: #666; margin-bottom: 4px; }
    .print-item-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .print-item-meta { font-size: 12px; color: #666; }
    .print-item-meta dt { font-weight: 500; display: inline; }
    .print-item-meta dd { display: inline; margin: 0 16px 0 4px; }
  }
`;

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}

function addMetaRow(dl, label, value) {
  if (value) {
    dl.appendChild(createEl('dt', null, `${label}:`));
    dl.appendChild(createEl('dd', null, String(value)));
  }
}

export default function exportPlanItemDetailsPDF({
  planItem,
  experienceName,
  groupedDetails,
  collaborators,
}) {
  const printContent = document.createElement('div');

  const style = document.createElement('style');
  style.textContent = PRINT_STYLES;
  printContent.appendChild(style);

  const header = createEl('div', 'print-header');
  const itemName = planItem?.text || 'Plan Item';
  const titleText = experienceName ? `${experienceName} - ${itemName}` : itemName;
  header.appendChild(createEl('h1', 'print-title', titleText));
  header.appendChild(
    createEl('p', 'print-subtitle', `Exported on ${new Date().toLocaleDateString()}`)
  );
  printContent.appendChild(header);

  Object.entries(groupedDetails || {}).forEach(([, category]) => {
    const categoryDiv = createEl('div', 'print-category');
    categoryDiv.appendChild(
      createEl('h2', 'print-category-title', `${category.icon} ${category.label}`)
    );

    category.items.forEach((item) => {
      const itemDiv = createEl('div', 'print-item');
      itemDiv.appendChild(
        createEl(
          'div',
          'print-item-type',
          `${item.typeConfig.icon} ${item.typeConfig.label}`
        )
      );
      itemDiv.appendChild(
        createEl(
          'div',
          'print-item-title',
          item.title ||
            item._displayTitle ||
            item.name ||
            item.trackingNumber ||
            item.confirmationNumber ||
            'Detail'
        )
      );

      const dl = document.createElement('dl');
      dl.className = 'print-item-meta';

      const displayFields = getDetailDisplayFields(item, { collaborators });
      displayFields.forEach((field) => {
        addMetaRow(dl, field.label, field.value);
      });

      itemDiv.appendChild(dl);
      categoryDiv.appendChild(itemDiv);
    });

    printContent.appendChild(categoryDiv);
  });

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.title = titleText;
    printWindow.document.body.appendChild(printContent.cloneNode(true));
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
    return { popupBlocked: false };
  }

  logger.warn('[exportPlanItemDetailsPDF] PDF export popup blocked by browser');
  return { popupBlocked: true };
}
