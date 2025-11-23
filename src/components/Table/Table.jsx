import React from 'react';
import PropTypes from 'prop-types';
import styles from './Table.module.scss';

/**
 * Table component with unified styling and hover states
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Table content (thead, tbody, etc.)
 * @param {boolean} props.hover - Whether rows should have hover effect
 * @param {boolean} props.striped - Whether rows should have alternating stripes
 * @param {boolean} props.bordered - Whether table should have borders
 * @param {boolean} props.responsive - Whether table should be responsive
 * @param {string} props.size - Table size: 'sm', 'md', 'lg'
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to table element
 */
export default function Table({
  children,
  hover = true,
  striped = false,
  bordered = false,
  responsive = true,
  size = 'md',
  className = '',
  style = {},
  ...props
}) {
  // Build className string with dynamic size classes
  const sizeClass = size !== 'md' ? styles[`table${size.charAt(0).toUpperCase() + size.slice(1)}`] : '';

  const classes = [
    styles.tableUnified,
    hover && styles.tableHover,
    striped && styles.tableStriped,
    bordered && styles.tableBordered,
    sizeClass,
    className
  ].filter(Boolean).join(' ');

  const tableElement = (
    <table
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </table>
  );

  if (responsive) {
    return (
      <div className={styles.tableResponsive}>
        {tableElement}
      </div>
    );
  }

  return tableElement;
}

Table.propTypes = {
  children: PropTypes.node.isRequired,
  hover: PropTypes.bool,
  striped: PropTypes.bool,
  bordered: PropTypes.bool,
  responsive: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableHead component for table header
 */
export function TableHead({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableHead, className].filter(Boolean).join(' ');

  return (
    <thead className={classes} style={style} {...props}>
      {children}
    </thead>
  );
}

TableHead.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableBody component for table body
 */
export function TableBody({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableBody, className].filter(Boolean).join(' ');

  return (
    <tbody className={classes} style={style} {...props}>
      {children}
    </tbody>
  );
}

TableBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableRow component for table rows
 */
export function TableRow({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableRow, className].filter(Boolean).join(' ');

  return (
    <tr className={classes} style={style} {...props}>
      {children}
    </tr>
  );
}

TableRow.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableCell component for table cells
 */
export function TableCell({
  children,
  header = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [styles.tableCell, className].filter(Boolean).join(' ');
  const Component = header ? 'th' : 'td';

  return (
    <Component className={classes} style={style} {...props}>
      {children}
    </Component>
  );
}

TableCell.propTypes = {
  children: PropTypes.node,
  header: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};