import { useState } from "react";

export const TOPIC_ATTITUDE_ITEMS = ["总体来说，我对AI在本主题中给出的回答持积极评价", "综合AI在本主题中给出的回答，我对它的整体评价是正面的", "我很确定自己对AI在本主题中给出的回答的评价", "对于如何评价AI在本主题中给出的回答，我的判断比较明确", "对AI在本主题中给出的回答，我既有满意的方面，也有不满意的方面", "我对AI在本主题中给出的回答同时存在认可和不满", "与AI讨论这个话题让我觉得愉快", "与AI讨论这个话题让我觉得烦躁", "我愿意继续和这个AI讨论下一个话题", "我更想换一个别的AI而不是继续跟它讨论", "AI在这个话题中给出的分析和建议是准确的", "AI在这个话题中的分析有错误或误导性"] as const;
export const OVERALL_ATTITUDE_ITEMS = ["综合到目前为止的全部讨论，我对这个AI助手持积极评价", "综合到目前为止的全部讨论，我对这个AI助手的整体评价是正面的", "我很确定自己对这个AI助手的整体评价", "对于如何评价这个AI助手，我的判断比较明确", "对这个AI助手，我既有满意的方面，也有不满意的方面", "我对这个AI助手同时存在认可和不满", "和这个AI对话总体上让我感到舒服", "和这个AI对话总体上让我觉得不自在", "我愿意在后续训练中继续使用这样的AI助手", "我宁愿找真人而不是用这个AI来讨论", "这个AI助手的专业能力是值得信赖的", "这个AI助手的分析能力不足以支撑飞行训练讨论"] as const;

export function AttitudeQuestionnaire({ title, topic = false, overall = false, extraItems = [], onSubmit }: { title: string; topic?: boolean; overall?: boolean; extraItems?: string[]; onSubmit: (answers: Record<string, number>) => Promise<void> | void }) {
  const items = [...(topic ? TOPIC_ATTITUDE_ITEMS.map((text, i) => [`topic_${i + 1}`, text] as const) : []), ...(overall ? OVERALL_ATTITUDE_ITEMS.map((text, i) => [`overall_${i + 13}`, text] as const) : []), ...extraItems.map((text, i) => [`change_${i + 1}`, text] as const)];
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const complete = items.every(([key]) => answers[key] !== undefined);
  const submit = async () => { if (!complete) return; setBusy(true); try { await onSubmit(answers); } finally { setBusy(false); } };
  return <div className="space-y-5"><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-gray-400">1 表示完全不同意/非常负面，5 表示完全同意/非常正面。</p>{items.map(([key, text]) => <div key={key} className="border-b border-gray-700 pb-3"><p className="text-sm mb-2">{text}</p><div className="flex gap-2">{[1,2,3,4,5].map(value => <button type="button" key={value} onClick={() => setAnswers(current => ({ ...current, [key]: value }))} className={`w-9 h-9 rounded ${answers[key] === value ? "bg-blue-600" : "bg-gray-700"}`}>{value}</button>)}</div></div>)}<button type="button" onClick={submit} disabled={!complete || busy} className="w-full py-3 bg-blue-600 disabled:bg-gray-600 rounded">{busy ? "提交中..." : "提交问卷"}</button></div>;
}
