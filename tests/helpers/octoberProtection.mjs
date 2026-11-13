// October rejection scenarios now exercise the authoritative current boundary.
export {protectFinancialReport as protectValuation,protectFinancialReport as safeStoredReport,protectedCopySummary as withheldSummary} from '../../lib/financialSafety.mjs';
export const isMarketAnalysisAvailable=report=>report?.financialDecision?.actionable===true&&report?.valuationVerification?.status==='trusted';
