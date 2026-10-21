// The first thing the overview says, directly under the toolbar: what is wrong
// (open incidents, failing or degraded checks), each a link to its section, or
// one quiet line that all is clear. The words carry the meaning; the coloured
// edge only draws the eye. No hooks, so it is in the server HTML.
import { Fragment, type ReactElement } from "react";
import { attentionItems, isAllClear, type AttentionSummary } from "../attention";
import styles from "./AttentionStrip.module.css";
import { Icon } from "./Icon";
import { RatingDot } from "./RatingDot";

export interface AttentionStripProps {
  summary: AttentionSummary;
}

const SEPARATOR = " · ";

export const AttentionStrip = ({ summary }: AttentionStripProps): ReactElement => {
  if (isAllClear(summary)) {
    return (
      <div className={styles.strip} data-tone="good">
        <RatingDot rating="good" className={styles.allClearDot} />
        <p className={styles.text}>All clear: no open incidents, every check OK</p>
      </div>
    );
  }

  return (
    <div className={styles.strip} data-tone="poor">
      <Icon className={styles.icon}>
        {/* A triangle with a mark: something needs a look. */}
        <path d="M8 2.5 14 13H2L8 2.5Z" />
        <path d="M8 6.5v3M8 11.25v.25" />
      </Icon>
      <p className={styles.text}>
        {attentionItems(summary).map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && SEPARATOR}
            <a href={item.href} className={styles.link}>
              {item.label}
            </a>
          </Fragment>
        ))}
      </p>
    </div>
  );
};
