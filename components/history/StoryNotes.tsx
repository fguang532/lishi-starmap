import { Feather, ExternalLink } from "lucide-react";
import { anecdotes } from "@/data/exploration";
export default function StoryNotes({
  eraId,
  nodeId,
  onNode,
}: {
  eraId: string;
  nodeId?: string;
  onNode: (id: string) => void;
}) {
  const notes = anecdotes.filter(
    (a) => a.eraId === eraId && (!nodeId || a.nodeIds.includes(nodeId)),
  );
  if (!notes.length) return null;
  return (
    <section className="story-notes">
      <h3>
        <Feather size={17} />
        史间拾趣
      </h3>
      {notes.map((a) => (
        <article key={a.id}>
          <span className="evidence-label">{a.evidenceLabel}</span>
          <h4>{a.title}</h4>
          <p>{a.text}</p>
          <a href={a.source.url} target="_blank" rel="noreferrer">
            {a.source.title} <ExternalLink size={12} />
          </a>
          {!nodeId && a.nodeIds[0] && (
            <button onClick={() => onNode(a.nodeIds[0])}>阅读相关档案 →</button>
          )}
        </article>
      ))}
    </section>
  );
}
