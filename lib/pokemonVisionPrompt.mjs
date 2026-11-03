// Shared by the production vision request and the opt-in offline benchmark.
// Never supply ground-truth labels to a model in a benchmark request.
export function buildVisionPrompt({cardName='Unknown card from image',typeLabel='Card',hasBack=false,verifiedIdentity=null}={}) {
  // Server supplies this only after local printed-identity verification. Never
  // pass benchmark reference labels here; this is condition-analysis context.
  const context=verifiedIdentity ? "Independently verified printed-card identity (catalog facts, not model recall): " + JSON.stringify(Object.fromEntries(['subject','cardNumber','year','brandSet','language','rarity'].filter(key=>verifiedIdentity[key]!=null).map(key=>[key,verifiedIdentity[key]]))) + ". Use this identity for context; do not re-identify it from memory. Transcribe any contradictory visible identifiers in identityReadings for review. Physical printing, authenticity and condition are NOT established by these catalog facts.\n\n" : "";
  const prompt = context +
  (verifiedIdentity ? "Analyze observable condition using the verified printed identity above. Do not replace it with model-recalled identity guesses; report contradictory visible text only as diagnostic readings.\n\n" : "Inspect observable card features and propose an identity for independent catalog verification. Identity proposals and photo observations are separate evidence, not verified facts.\n\n") +
  "Card name: " + (verifiedIdentity?.subject || cardName || "unknown") + "\n" +
  "Card type: " + typeLabel + "\n\n" +

  "Report observable defects and inspection limitations. Do not blend guessed set/year claims into condition findings or generate PSA forecasts. The application generates explanations after independent identity reconciliation.\n\n" +

  "Assess ONLY what is visible in the uploaded image. If the back of the card is not visible, say that this limits confidence. If glare, sleeve reflection, angle, blur, or low resolution limits surface inspection, say so.\n\n" +

  "Use neutral visual inspection, not a search for reasons to downgrade. Pack-fresh is not proof of mint; glare and sleeve edges are not damage. Record only supported cues, uncertainty and limitations. No PSA forecast or grading suitability.\n\n" +
"Card identification task:\n" +
"- These are unverified proposals. Read the full printed collector number, language and set code when legible. Familiar artwork alone cannot establish a set/year or high confidence. Never invent missing printed text.\n" +
"- Identify the card as specifically as possible from the image and provided card name.\n" +
"- Look for year, brand, set, player/character, card number, parallel, serial numbering, autograph/relic indicators, and visible text.\n" +
"- Do not invent details. If a detail is uncertain, use null and explain uncertainty in identityNotes.\n" +
"- Year identification: prioritize a year actually visible on the card or strongly supported by visible product identifiers. General model knowledge alone is not year evidence.\n" +
"- Never override a visible year merely because you remember a different set release year.\n" +
"- If a visible copyright year is the best available evidence, you may return it as a cautious proposed year; explain the visible copyright basis in identityNotes and do not describe it as a verified release year.\n" +
"- If year evidence conflicts or is genuinely uncertain, return identifiedYear as null rather than guessing, and explain the conflict or uncertainty in identityNotes.\n" +
"- identityConfidence should be high only when visible card text and provided card name strongly agree.\n\n" +

  "Respond with ONLY a single raw JSON object. No markdown. No backticks. No extra text.\n\n" +

  "Separate visual evidence from identity speculation. Condition findings must describe observable defects only, never set/year, value, grading suitability or PSA predictions.\n" +
  "visualObservations - array of {attribute,code,certainty,evidence}. certainty is confirmed, suspected or unassessable. A confirmed claim requires evidence {side:front|back,region:[x,y,width,height] normalized 0..1,cue,confidence:0..1}. Confidence >=0.8, a clearly localized cue (damage regions covering most of the card are not localized) and no obscuring reflection/sleeve/blur are required. If not established, use suspected/unassessable, never invent damage.\n" +
  "Codes: centering off_center/miscut; corners whitening/softening/bend/crease; edges whitening/chipping/wear/peeling; surface scratches/print_lines/dent/crease/bend/staining. no_defect_observed is allowed only for a clearly inspected localized area, never means mint.\n" +
  "Cues by code: off_center=border_width_difference, miscut=truncated_print_border, whitening/wear=localized_color_loss, softening=rounded_corner_outline, bend/crease=surface_deformation, chipping=missing_edge_fragment, peeling=lifted_layer, scratches=surface_line, print_lines=printed_line, dent=surface_depression, staining=color_patch, no_defect_observed=clear_inspected_area. Off_center additionally requires evidence.measurement {axis:horizontal|vertical,ratio:[left,right] summing100}; without a visible-border measurement it is suspected. Artwork perspective is not off-centering.\n" +
  "identityReadings - array {field:subject|cardNumber|setCode|language|rarityMark,text,certainty:clear|uncertain|unreadable,side:front|back,area:name|collector_line|set_mark|rarity_mark|body_text,alternatives:[]}. Transcribe visible printed text, including full collector number denominator; do not fill markings from model memory. Separate uncertain alternatives. Contradictory clear readings require confirmation. Rarity marks and holo printing are different attributes.\n" +
  "imageLimitations - array containing only glare, blur, sleeve, back_not_visible, limited_resolution when applicable.\n" +
  "Required fields:\n" +
  "identifiedYear - cautious proposed year actually visible on the card or strongly supported by visible product identifiers; a best-evidence visible copyright year is allowed with its basis explained in identityNotes; never override a visible year with remembered release-year knowledge; return null for conflicting or genuinely uncertain year evidence (string or null)\n" +
"identifiedFranchise - broad card universe such as Pokemon, Baseball, Basketball, Football, Hockey, Soccer, Disney Lorcana, Star Wars, One Piece, Magic, Yu-Gi-Oh, Marvel, Garbage Pail Kids, or unknown (string)\n" +
"identifiedManufacturer - likely maker/publisher such as Pokemon, Topps, Panini, Upper Deck, Wizards of the Coast, Ravensburger, Bandai, Konami, or unknown (string)\n" +
"identifiedBrandSet - likely brand, product, set, or release name if visible or inferable, otherwise null (string or null)\n" +
"identifiedSubject - player, character, creature, team, or card subject if visible or inferable, otherwise null (string or null)\n" +
"identifiedCardNumber - collector/card number exactly as visible if possible, otherwise null (string or null)\n" +
"identifiedParallel - printing/artwork/parallel only when visibly supported, otherwise null. Rarity is separate and cannot establish finish (string or null)\nidentifiedRarity - proposed rarity only from visible markings, otherwise null; the catalog must independently verify rarity\n" +
"identifiedLanguage - likely card language such as English, Japanese, Korean, Chinese, Spanish, French, German, Italian, Portuguese, or unknown (string)\n" +
"identifiedAutoOrRelic - one of: auto, relic, auto relic, none, unknown (string)\n" +
"identityConfidence - 0-100 confidence in the card identity. Be conservative when set, number, language, or parallel are uncertain (integer)\n" +
"identityNotes - one short sentence explaining which identity facts are strongly supported and which are uncertain (string)\n" +
  "centering - one of: excellent, good, fair, poor, or null if unassessed\n" +
  "centeringNote - specific visible centering assessment, mention left/right and top/bottom if visible (string)\n" +
  "corners - one of: excellent, good, fair, poor, or null if unassessed\n" +
  "cornersNote - specific visible corner assessment, mention any whitening, softness, fraying, bends, or unclear areas (string)\n" +
  "edges - one of: excellent, good, fair, poor, or null if unassessed\n" +
  "edgesNote - specific visible edge assessment, mention whitening, chipping, rough cuts, or unclear areas (string)\n" +
  "surface - one of: excellent, good, fair, poor, or null if unassessed\n" +
  "surfaceNote - specific visible surface assessment, mention scratches, print lines, dimples, glare limitations, haze, staining, or uncertainty (string)\n" +
  "overallScore - null; photo observations are not a numeric PSA grade\n" +
    "gradeCeiling - null; do not forecast a PSA ceiling\n" +
"primaryLimiter - null; explanations are generated from supported observations\n" +
    "majorGradeCap - null; photos do not establish grade ceilings\n" +
"minorConcerns - short collector-style list of smaller visible risks or uncertainties separated by commas (string)\n" +
"confidenceLevel - one of: high, moderate, low (string)\n" +
  "gradingRisk - diagnostic description of observable damage or inspection limits only; no identity, price or numeric grade (string)\n" +
  "estimatedGrade - null; do not generate candidate labels\n" +
  "mostLikelyGradeRange - null; no grade projection\n" +
  "psa10Upside - null; no grade projection\n" +
  "gemRiskFactors - empty array; do not speculate about grading outcomes\n" +
  "worthGrading - null; submission recommendations require independent evidence\n" +
  "worthGradingReason - diagnostic description of visible condition caution only, not financial or positive submission advice (string)\n" +
  "imageSummary - 1-2 sentences summarizing the card's visible condition and confidence level (string)\n\n" +

  "Rating scale:\n" +
  "excellent = no meaningful visible flaw in that category\n" +
  "good = minor visible flaw or slight uncertainty\n" +
  "fair = moderate visible flaw that may cap grade\n" +
  "poor = significant visible flaw likely to strongly cap grade\n\n" +

    "Confidence guidance:\n" +
"high = strong image quality with clearly visible surfaces, corners, and edges\n" +
"moderate = some uncertainty from glare, angle, reflections, or missing card back\n" +
"low = image quality too limited for confident grading assessment\n\n" +

  "Be strict, specific, and internally consistent. Avoid canned language.";

 return prompt + (hasBack ? "\n\nBoth front and back images are provided. Evaluate both sides when assessing confidence, corners, edges, whitening, and grading risk." : "\n\nOnly the front image is provided. Missing back image should reduce confidence where appropriate.");
}
