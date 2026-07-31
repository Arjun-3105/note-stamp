import { motion, type Variants } from "framer-motion";

type Assignment = {
  isCodingVideo?: boolean;
  title: string; description: string;
  track: "frontend" | "backend" | "fullstack";
  requirements?: string[]; checkpoints?: string[];
  hint: string; topic: string; starterIdea?: string;
  quiz?: { question: string; options: string[]; answerIndex: number }[];
};

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { ease: "easeOut", duration: 0.4 } },
};

export default function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const isCoding = assignment.isCodingVideo ?? true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
      className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f]"
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
            {assignment.topic}
          </span>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
            {isCoding ? assignment.track : "Knowledge Check"}
          </span>
        </div>
        <h3 className="text-xl font-black tracking-tight text-white">{assignment.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">{assignment.description}</p>
      </div>

      {isCoding ? (
        <>
          {/* Requirements */}
          <div className="border-b border-white/[0.06] px-6 py-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Requirements</p>
            <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {assignment.requirements?.map((r, i) => (
                <motion.li key={i} variants={row} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-white/[0.06] text-[9px] font-black text-[#666]">
                    {i + 1}
                  </span>
                  <span className="text-sm text-[#ccc]">{r}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* Checkpoints */}
          <div className="border-b border-white/[0.06] px-6 py-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Checkpoints</p>
            <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {assignment.checkpoints?.map((cp, i) => (
                <motion.li key={i} variants={row} className="flex items-start gap-3 text-sm text-[#666]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#333]" />
                  {cp}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </>
      ) : (
        <div className="border-b border-white/[0.06] px-6 py-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Knowledge Quiz</p>
          <p className="text-sm text-[#ccc]">This content focuses on concepts rather than practical coding. You must pass a {assignment.quiz?.length || 3}-question knowledge quiz to earn your Proof of Learning NFT.</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-5">
        {isCoding && assignment.starterIdea && (
          <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#444]">Starter idea</p>
            <p className="text-sm text-[#888]">{assignment.starterIdea}</p>
          </div>
        )}
        {assignment.hint && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#444]">Hint</p>
            <p className="text-sm text-[#888]">{assignment.hint}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

