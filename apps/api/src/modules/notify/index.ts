export { approvalFacts, disputeFacts } from "./facts";
export {
  type EmailJob,
  enqueueEmail,
  jobKey,
  NOTIFY_QUEUE,
  type NotifyQueue,
  runEmailJob,
  setNotifyQueue,
  startNotifyJobs,
} from "./jobs";
export { emailJobFor, notifyPlugin } from "./plugin";
export {
  type ApprovalFacts,
  approvalEmail,
  describeReason,
  type DisputeFacts,
  disputeEmail,
  escapeHtml,
  MAX_QUOTED_CHARS,
  type RenderedEmail,
  truncate,
} from "./render";
export {
  DEFAULT_EMAIL_FROM,
  DEFAULT_WEB_URL,
  type Email,
  type NotifyConfig,
  notifyConfigFromEnv,
  type NotifyEnv,
  sendEmail,
} from "./send";
