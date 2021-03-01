/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable arrow-body-style */

import * as commonmark from 'commonmark';
import { DateTime } from 'luxon';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/pipeable';
import * as EitherUtils from '../utils/EitherUtils';
import { parseVersionE, Version } from './Version';

interface Offset {
  start: number;
  end: number;
}

interface Item extends Offset {
  jira?: string;
}

interface Section extends Offset {
  header: Offset;
  list: Offset;
  items: Item[];
}

type SectionNames = 'Added' | 'Improved' | 'Changed' | 'Deprecated' | 'Removed' | 'Fixed' | 'Security';

interface ChangelogFragment {
  sections: SectionNames[];
  Added?: Section;
  Improved?: Section;
  Changed?: Section;
  Deprecated?: Section;
  Removed?: Section;
  Fixed?: Section;
  Security?: Section;
}

interface ReleaseMeta {
  version: Version;
  date: DateTime;
}

interface Release extends ChangelogFragment, Offset {
  header: Offset;
  meta?: ReleaseMeta;
}

export interface Changelog {
  source: string;
  releases: Release[];
  preamble: Offset;
  links: Offset;
}

interface TextLines {
  text: string;
  lines: number[];
}

interface Heading {
  header: commonmark.Node;
  preamble: commonmark.Node[];
  subheadings: Heading[];
}

interface Top {
  header?: undefined;
  preamble: commonmark.Node[];
  subheadings: Heading[];
}

const findLineStarts = (text: string): TextLines => {
  const lines = [ 0 ];
  let seenCR = false;
  let seenLF = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '\n') {
      if (seenLF) {
        // add line start and reset
        lines.push(i);
        seenCR = false;
        seenLF = false;
      }
      seenLF = true;
    } else if (c === '\r') {
      if (seenCR) {
        // add line start and reset
        lines.push(i);
        seenCR = false;
        seenLF = false;
      }
      seenCR = true;
    } else {
      if (seenLF || seenCR) {
        // add line start and reset
        lines.push(i);
        seenLF = false;
        seenCR = false;
      }
    }
  }
  return { text, lines };
};

const posToOffset = (lines: number[], position: [number, number]) => {
  // both line and column count from 1
  const [ line, column ] = position;
  return lines[line - 1] + (column - 1);
};

// the range including just the columns of the node
const columnRange = (lines: number[], node: commonmark.Node): Offset => {
  // this is the inclusive range
  const [ startPos, endPos ] = node.sourcepos;
  const start = posToOffset(lines, startPos);
  const end = posToOffset(lines, endPos);
  return { start, end };
};

// the range including the whole lines that the node is in
const blockRange = (source: TextLines, node: commonmark.Node): Offset => {
  const [[ startLine ], [ endLine ]] = node.sourcepos;
  const start = posToOffset(source.lines, [ startLine, 1 ]);
  const end = (endLine < source.lines.length ? posToOffset(source.lines, [ endLine + 1, 1 ]) : source.text.length) - 1;
  return { start, end };
};

const extractText = (source: TextLines, node: commonmark.Node): string => {
  const range = columnRange(source.lines, node);
  return source.text.substring(range.start, range.end + 1);
};

const pos = (node: commonmark.Node): string => {
  if (node.sourcepos !== undefined) {
    const [[ startLine, startColumn ]] = node.sourcepos;
    return ` (line: ${startLine} column: ${startColumn})`;
  } else {
    return '';
  }
};

const parseHeadings = (changelog: string): Top => {
  const data: Top = { preamble: [], subheadings: [] };
  const reader = new commonmark.Parser();
  const doc = reader.parse(changelog);
  const stack: (Heading | Top)[] = [ data ];
  let node: commonmark.Node | null = doc.firstChild;
  while (node !== null) {
    if (node.type === 'heading') {
      // pop headings off the stack that are higher or equal level
      while (true) {
        const last = stack[stack.length - 1];
        if (node.level <= (last?.header?.level ?? 0)) {
          stack.pop();
        } else {
          break;
        }
      }
      // push this as a new child heading
      const heading: Heading = {
        header: node,
        preamble: [],
        subheadings: []
      };
      stack[stack.length - 1].subheadings.push(heading);
      stack.push(heading);
    } else {
      stack[stack.length - 1].preamble.push(node);
    }
    node = node.next;
  }
  return data;
};

const jiraRe = /\s+#(?<jira>[A-Z]{2,10}-\d+)\s*$/;
const parseItem = (source: TextLines, node: commonmark.Node): E.Either<string[], Item> => {
  if (node.type !== 'item') {
    return E.left([ 'Expected a list item' + pos(node) ]);
  }
  const offset = blockRange(source, node);
  const itemText = extractText(source, node);
  const m = jiraRe.exec(itemText);
  const jira = m?.groups?.jira;
  return E.right({
    ...offset,
    jira
  });
};

const parseList = (source: TextLines, list: commonmark.Node): E.Either<string[], Item[]> => {
  const itemsE: E.Either<string[], Item>[] = [];
  let item = list.firstChild;
  while (item) {
    itemsE.push(parseItem(source, item));
    item = item.next;
  }
  return EitherUtils.combine(itemsE);
};

const sectionNames: SectionNames[] = [ 'Added', 'Improved', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security' ];
const sectionRes = sectionNames.map((sectionName) => new RegExp(`^### ${sectionName}$`));
const parseFragment = (source: TextLines, sectionHeadings: Heading[]): E.Either<string[], ChangelogFragment> => {
  const fragment: ChangelogFragment = { sections: [] };
  let errors: string[] = [];
  const seenSection: Record<number, commonmark.Node> = {};
  let searchStart = 0;
  for (const sectionHeading of sectionHeadings) {
    if (sectionHeading.header.level !== 3) {
      errors.push('Expected heading to be level 3' + pos(sectionHeading.header));
    }
    const headingText = extractText(source, sectionHeading.header);
    const idx = sectionRes.findIndex((sectionRe) => sectionRe.test(headingText));
    if (idx === -1) {
      errors.push('Expected heading to match one of: "### ' + sectionNames.slice(searchStart).join('", "### ') + '"' + pos(sectionHeading.header));
    } else if (seenSection[idx] !== undefined) {
      errors.push('Heading "### ' + sectionNames[idx] + '" is a repeat' + pos(sectionHeading.header));
    } else if (idx < searchStart) {
      errors.push('Expected heading "### ' + sectionNames[idx] +
      '" to be listed earlier as headings must be in the order ' +
      sectionNames.join(', ') + pos(sectionHeading.header));
    } else {
      searchStart = idx;
    }
    if (idx > 0 && seenSection[idx] === undefined) {
      seenSection[idx] = sectionHeading.header;
    }
    if (sectionHeading.subheadings.length > 0) {
      errors.push('Unexpected subheadings' + pos(sectionHeading.subheadings[0].header));
    }
    if (sectionHeading.preamble.length === 0) {
      errors.push('Expected a bullet list under the section header but found nothing' + pos(sectionHeading.header));
    } else if (sectionHeading.preamble.length > 1) {
      errors.push('Expected a bullet list but found more than one node' + pos(sectionHeading.preamble[1]));
    } else if (sectionHeading.preamble[0].type !== 'list') {
      errors.push('Expected a bullet list but found a non-list node' + pos(sectionHeading.preamble[0]));
    } else if (sectionHeading.preamble[0].listType !== 'bullet') {
      errors.push('Expected a bullet list but found a ordered list' + pos(sectionHeading.preamble[0]));
    } else {
      const header = blockRange(source, sectionHeading.header);
      const node = sectionHeading.preamble[0];
      const list = blockRange(source, node);
      fragment.sections.push(sectionNames[idx]);
      fragment[sectionNames[idx]] = pipe(
        parseList(source, node),
        E.map((items) => ({ header, list, items, start: header.start, end: list.end })),
        E.getOrElse((e) => {
          errors = errors.concat(e);
          return undefined as Section | undefined;
        })
      );
    }
  }
  return errors.length > 0 ? E.left(errors) : E.right(fragment);
};

const unreleasedRe = /^## (?<lbkt>\[?)Unreleased(?<rbkt>\]?)$/;
const releaseRe = /^## (?<lbkt>\[?)(?<version>\d+\.\d+\.\d+)(?<rbkt>\]?) - (?<date>\d{4}-\d{2}-\d{2})$/;
const parseRelease = (source: TextLines, release: Heading, first: boolean): E.Either<string[], Release> => {
  let meta: ReleaseMeta | undefined;
  const errors: string[] = [];
  const headerText = extractText(source, release.header);
  const header = blockRange(source, release.header);
  let m: RegExpMatchArray | null = null;
  if ((m = unreleasedRe.exec(headerText)) && (m.groups?.lbkt?.length ?? 0) === (m.groups?.rbkt?.length ?? 0)) {
    if (!first) {
      errors.push('Unexpected "Unreleased" header' + pos(release.header));
    }
  } else if ((m = releaseRe.exec(headerText)) && (m.groups?.lbkt?.length ?? 0) === (m.groups?.rbkt?.length ?? 0)) {
    const versionStr = m.groups?.version ?? '';
    const dateStr = m.groups?.date ?? '';
    const versionE = parseVersionE(versionStr);
    const date = DateTime.fromISO(dateStr, { zone: 'utc' });
    if (versionE._tag === 'Left') {
      errors.push('Bad version in header "' + versionE.left + '"' + pos(release.header));
    } else {
      meta = { version: versionE.right, date };
    }
  } else {
    errors.push('Unexpected header text to be ' + (first ? '"Unreleased" or ' : '') + '"<version> - <date>"' + pos(release.header));
  }
  if (release.preamble.length > 0) {
    errors.push('Unexpected content under release header' + pos(release.preamble[0]));
  }
  return pipe(
    parseFragment(source, release.subheadings),
    E.fold(
      (e) => E.left(errors.concat(e)),
      (v) => errors.length > 0 ? E.left(errors) : E.right(v)
    ),
    E.map((fragment) => {
      const start = header.start;
      const sectionCount = fragment.sections.length;
      const lastSection = sectionCount > 0 ? fragment.sections[sectionCount - 1] : 'Added';
      const end = fragment[lastSection]?.end ?? header.end;
      return { ...fragment, meta, header, start, end };
    })
  );
};

const parseReleases = (source: TextLines, releases: Heading[]): E.Either<string[], Release[]> => {
  return EitherUtils.combine(releases.map((release, i) => parseRelease(source, release, i === 0)));
};

const parseTop = (source: TextLines, top: Top): E.Either<string[], Changelog> => {
  const errors: string[] = [];
  if (top.preamble.length > 0) {
    errors.push('Unexpected content without heading' + pos(top.preamble[0]));
  }
  if (top.subheadings.length === 0) {
    errors.push('No top level heading');
    return E.left(errors);
  }
  if (top.subheadings.length > 1) {
    errors.push('Unexpected additional top level headings' + pos(top.subheadings[1].header));
  }
  const topHeading = top.subheadings[0];
  if (topHeading.header.level !== 1) {
    errors.push('First top-level heading is not a h1' + pos(topHeading.header));
  }
  const headingText = extractText(source, topHeading.header);
  if (!/Change[ -]?log/i.test(headingText)) {
    errors.push('First top-level heading does not contain "Changelog"' + pos(topHeading.header));
  }
  return errors.length > 0 ? E.left(errors) : pipe(
    parseReleases(source, topHeading.subheadings),
    E.map((releases) => {
      const endOfPreamble = (() => {
        if (releases.length > 0) {
          return releases[0].start - 1;
        } else if (topHeading.preamble.length > 0) {
          return blockRange(source, topHeading.preamble[topHeading.preamble.length - 1]).end;
        } else {
          return blockRange(source, topHeading.header).end;
        }
      })();
      const preamble = { start: 0, end: endOfPreamble };
      const startOfLinks = releases.length > 0 ? releases[releases.length - 1].end + 1 : endOfPreamble + 1;
      const links = { start: startOfLinks, end: source.text.length };
      return { source: source.text, releases, preamble, links };
    })
  );
};

/**
 * Attempt to parse a changelog.
 * @param text the changelog to parse.
 */
export const parseChangelog = (text: string) => {
  return parseTop(findLineStarts(text), parseHeadings(text));
};