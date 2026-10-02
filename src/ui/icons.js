const NS = 'http://www.w3.org/2000/svg';

function svgIcon(shapes, viewBox = '0 0 16 16') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');

  for (const shape of shapes) {
    const node = document.createElementNS(NS, shape.tag || 'path');
    if (shape.d) node.setAttribute('d', shape.d);
    if (shape.rect) {
      node.setAttribute('x', shape.rect[0]);
      node.setAttribute('y', shape.rect[1]);
      node.setAttribute('width', shape.rect[2]);
      node.setAttribute('height', shape.rect[3]);
      if (shape.rect[4] !== undefined) node.setAttribute('rx', shape.rect[4]);
    }
    if (shape.circle) {
      node.setAttribute('cx', shape.circle[0]);
      node.setAttribute('cy', shape.circle[1]);
      node.setAttribute('r', shape.circle[2]);
    }
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', shape.sw || '1.5');
    svg.appendChild(node);
  }
  return svg;
}

export const icons = {
  lock: () => svgIcon([{ rect: [3, 7, 10, 7, 1.5] }, { d: 'M5 7V5a3 3 0 0 1 6 0v2', sw: 1.4 }]),
  check: () => svgIcon([{ d: 'M3 8.5 6.5 12 13 4.5', sw: 1.6 }]),
  warn: () => svgIcon([{ d: 'M8 1.8 15 14H1L8 1.8Z', sw: 1.4 }, { d: 'M8 6v4M8 12.2v.1', sw: 1.4 }]),
  error: () => svgIcon([{ circle: [8, 8, 6.5] }, { d: 'M5.5 5.5l5 5M10.5 5.5l-5 5' }]),
  close: () => svgIcon([{ d: 'M3 3l10 10M13 3 3 13' }]),
  eye: () => svgIcon([{ d: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z', sw: 1.4 }, { circle: [8, 8, 2], sw: 1.4 }]),
  edit: () => svgIcon([{ d: 'M11.3 1.9 14 4.6 5.1 13.5 1.8 14l.5-3.3 9-8.8Z', sw: 1.4 }]),
  trash: () => svgIcon([{ d: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4', sw: 1.4 }]),
  chevronRight: () => svgIcon([{ d: 'M6 3.5 11 8l-5 4.5', sw: 1.8 }])
};
