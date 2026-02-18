import pptxgen from 'pptxgenjs';
import type { RoadmapItem, SprintConfig } from '../types';
import { CATEGORY_BAR_COLORS } from '../data/poolItems';
import { sprintStartDate, sprintEndDate, formatDate, fromISODateString } from './workingDays';

function getItemDates(item: RoadmapItem, sprintConfig: SprintConfig): { start: string; end: string } {
  if (item.startSprint !== undefined && item.endSprint !== undefined) {
    return {
      start: formatDate(sprintStartDate(item.startSprint, sprintConfig)),
      end: formatDate(sprintEndDate(item.endSprint, sprintConfig)),
    };
  }
  if (item.startDate && item.endDate) {
    return {
      start: formatDate(fromISODateString(item.startDate)),
      end: formatDate(fromISODateString(item.endDate)),
    };
  }
  return { start: 'TBD', end: 'TBD' };
}

export async function exportToPptx(items: RoadmapItem[], sprintConfig: SprintConfig): Promise<void> {
  const prs = new pptxgen();
  prs.layout = 'LAYOUT_WIDE';

  for (const item of items) {
    const slide = prs.addSlide();
    slide.background = { color: '1e293b' };

    // Category accent bar (left vertical strip)
    const accentColor = (item.category ? CATEGORY_BAR_COLORS[item.category]?.replace('#', '') : null) || '94a3b8';
    slide.addShape('rect' as any, {
      x: 0,
      y: 0,
      w: 0.12,
      h: '100%',
      fill: { color: accentColor },
      line: { color: accentColor },
    } as any);

    const dates = getItemDates(item, sprintConfig);
    const titleText = item.epicName || item.name;

    // Title
    slide.addText(titleText, {
      x: 0.3,
      y: 0.2,
      w: 12.8,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Calibri',
    });

    // Divider line
    slide.addShape('line' as any, {
      x: 0.3,
      y: 0.85,
      w: 12.8,
      h: 0,
      line: { color: '475569', width: 1 },
    } as any);

    // Left column content (Owners, Objectives, Description)
    const leftItems: pptxgen.TextProps[] = [];
    if (item.owners?.length) {
      leftItems.push({ text: 'Owners\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      item.owners.filter(Boolean).forEach(o => leftItems.push({ text: `\u2022 ${o}\n`, options: { color: 'FFFFFF', fontSize: 11 } }));
      leftItems.push({ text: '\n', options: {} });
    }
    if (item.objectives?.length) {
      leftItems.push({ text: 'Objectives\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      item.objectives.filter(Boolean).forEach(o => leftItems.push({ text: `\u2022 ${o}\n`, options: { color: 'FFFFFF', fontSize: 11 } }));
      leftItems.push({ text: '\n', options: {} });
    }
    if (item.description) {
      leftItems.push({ text: 'Description\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      leftItems.push({ text: `${item.description}\n\n`, options: { color: 'FFFFFF', fontSize: 11 } });
    }

    // Right column content (Dependencies, Acceptance Criteria, Timeline, Target Audience)
    const rightItems: pptxgen.TextProps[] = [];
    if (item.dependencies?.length) {
      rightItems.push({ text: 'Dependencies\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      item.dependencies.filter(Boolean).forEach(d => rightItems.push({ text: `\u2022 ${d}\n`, options: { color: 'FFFFFF', fontSize: 11 } }));
      rightItems.push({ text: '\n', options: {} });
    }
    if (item.acceptanceCriteria?.length) {
      rightItems.push({ text: 'Acceptance Criteria\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      item.acceptanceCriteria.filter(Boolean).forEach(c => rightItems.push({ text: `\u2022 ${c}\n`, options: { color: 'FFFFFF', fontSize: 11 } }));
      rightItems.push({ text: '\n', options: {} });
    }
    rightItems.push({ text: 'Timeline\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
    rightItems.push({ text: `\u2022 Start: ${dates.start}\n`, options: { color: 'FFFFFF', fontSize: 11 } });
    rightItems.push({ text: `\u2022 End: ${dates.end}\n\n`, options: { color: 'FFFFFF', fontSize: 11 } });
    if (item.targetAudience?.length) {
      rightItems.push({ text: 'Target Audience\n', options: { bold: true, color: '94a3b8', fontSize: 12 } });
      item.targetAudience.filter(Boolean).forEach(a => rightItems.push({ text: `\u2022 ${a}\n`, options: { color: 'FFFFFF', fontSize: 11 } }));
    }

    if (leftItems.length > 0) {
      slide.addText(leftItems, { x: 0.3, y: 1.0, w: 6.0, h: 5.5, fontFace: 'Calibri', valign: 'top' });
    }
    if (rightItems.length > 0) {
      slide.addText(rightItems, { x: 6.8, y: 1.0, w: 6.3, h: 5.5, fontFace: 'Calibri', valign: 'top' });
    }
  }

  await prs.writeFile({ fileName: `roadmap-epics-${new Date().toISOString().split('T')[0]}.pptx` });
}
