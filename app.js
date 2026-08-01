(() => {
  "use strict";

  const state = {
    mode: "2",
    styles: {"2": "balanced", "3": "balanced"},
    anchorId: "",
    secondId: "",
    thirdId: "",
    shuffleSeed: 0,
    cabinetFilter: "all",
    cabinetQuery: "",
    preferredCombo: []
  };

  const STYLE_OPTIONS = {
    "2": [
      {id: "balanced", label: "Balanced"},
      {id: "contrast", label: "Maximum contrast"},
      {id: "echo", label: "Same lane"}
    ],
    "3": [
      {id: "balanced", label: "Balanced"},
      {id: "creamy-sorbet", label: "2 creamy + 1 sorbet"},
      {id: "indulgent", label: "Indulgent"},
      {id: "fruit", label: "Fruit-forward"},
      {id: "no-sorbet", label: "No sorbet"}
    ]
  };

  const GENERIC_TAGS = new Set(["creamy", "fresh", "clean", "fruit", "nut", "chocolate", "biscuit"]);
  const FRUIT_TAGS = new Set(["fruit", "berry", "strawberry", "citrus", "lemon", "mango", "passionfruit", "lychee", "tropical", "raisin", "dried fruit"]);
  const CHOCOLATE_TAGS = new Set(["chocolate", "dark chocolate", "milk chocolate", "white chocolate", "cocoa", "fudge"]);
  const NUT_TAGS = new Set(["nut", "hazelnut", "pistachio", "macadamia", "peanut", "praline"]);
  const BAKERY_TAGS = new Set(["biscuit", "cookie", "cake", "shortbread", "waffle", "pancake", "toast", "malt"]);
  const CARAMEL_TAGS = new Set(["caramel", "dulce de leche", "honey"]);
  const CREAM_TAGS = new Set(["creamy", "custard", "vanilla", "milk", "mascarpone", "cheesecake", "yoghurt", "cream"]);

  const AFFINITIES = [
    [CHOCOLATE_TAGS, FRUIT_TAGS, 11],
    [CHOCOLATE_TAGS, NUT_TAGS, 10],
    [CHOCOLATE_TAGS, new Set(["coffee", "espresso", "roast"]), 9],
    [NUT_TAGS, FRUIT_TAGS, 9],
    [NUT_TAGS, new Set(["coffee", "espresso", "roast"]), 8],
    [CARAMEL_TAGS, new Set(["coffee", "espresso", "roast", "bitter"]), 10],
    [CARAMEL_TAGS, FRUIT_TAGS, 7],
    [BAKERY_TAGS, FRUIT_TAGS, 8],
    [BAKERY_TAGS, new Set(["coffee", "espresso", "roast"]), 8],
    [new Set(["coconut", "pandan"]), new Set(["mango", "lychee", "passionfruit", "tropical"]), 11],
    [CREAM_TAGS, FRUIT_TAGS, 7],
    [new Set(["mint"]), CHOCOLATE_TAGS, 10],
    [new Set(["salt", "salty"]), CHOCOLATE_TAGS, 6],
    [new Set(["salt", "salty"]), CARAMEL_TAGS, 6]
  ];

  const elements = {};
  let flavours = [];
  let flavourById = new Map();
  let rotation = null;
  let toastTimer = null;

  const hasAny = (flavour, tagSet) => flavour.tags.some(tag => tagSet.has(tag));
  const isSorbet = flavour => flavour.format.toLowerCase() === "sorbet";
  const isCreamy = flavour => !isSorbet(flavour);
  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
  const hash = text => [...text].reduce((value, character) => ((value << 5) - value + character.charCodeAt(0)) | 0, 0);
  const prettyDate = value => new Intl.DateTimeFormat("en-AU", {day: "numeric", month: "short", year: "numeric"}).format(new Date(`${value}T12:00:00Z`));
  const cleanName = value => value.replace(/^★\s*/, "");

  function cacheElements() {
    [
      "rotation-label", "flavour-count", "special-count", "checked-date", "hero-random",
      "anchor-select", "second-select", "third-select", "third-field", "second-role-name", "second-role-help", "builder-hint", "clear-cup",
      "random-anchor", "style-options", "anchor-summary", "results-title",
      "recommendations", "shuffle-results", "cabinet-search", "cabinet-filters", "flavour-grid",
      "no-flavour-results", "toast"
    ].forEach(id => { elements[id] = document.getElementById(id); });
    elements.modeButtons = [...document.querySelectorAll("[data-mode]")];
  }

  async function loadData() {
    const responses = await Promise.all([
      fetch("data/classics.json", {cache: "no-cache"}),
      fetch("data/specials.json", {cache: "no-cache"})
    ]);
    if (responses.some(response => !response.ok)) throw new Error("Cabinet data could not be loaded.");
    const [classics, specials] = await Promise.all(responses.map(response => response.json()));
    rotation = specials.rotation;
    flavours = [...classics.flavours, ...specials.flavours];
    flavourById = new Map(flavours.map(flavour => [flavour.id, flavour]));
    return {classics, specials};
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "2" || mode === "3") state.mode = mode;
    const style = params.get("style");
    if (STYLE_OPTIONS[state.mode].some(option => option.id === style)) state.styles[state.mode] = style;
    const combo = [...new Set((params.get("combo") || "").split("~").filter(id => flavourById.has(id)))];
    const anchor = params.get("anchor");
    if (combo.length) state.anchorId = combo[0];
    else if (anchor && flavourById.has(anchor)) state.anchorId = anchor;
    if (combo.length >= 2) state.secondId = combo[1];
    if (state.mode === "3" && combo.length >= 3) state.thirdId = combo[2];
    if (combo.length === Number(state.mode)) state.preferredCombo = combo;
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    params.set("mode", state.mode);
    if (state.anchorId) params.set("anchor", state.anchorId);
    params.set("style", state.styles[state.mode]);
    const combo = [state.anchorId, state.secondId];
    if (state.mode === "3") combo.push(state.thirdId);
    const selected = combo.filter(Boolean);
    if (selected.length > 1) params.set("combo", selected.join("~"));
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }

  function updateCabinetMeta(data) {
    const specials = data.specials.flavours;
    elements["flavour-count"].textContent = String(flavours.length);
    elements["special-count"].textContent = String(specials.length);
    elements["checked-date"].textContent = prettyDate(data.specials.source.checkedAt);
    const end = rotation?.to ? prettyDate(rotation.to).replace(/ \d{4}$/, "") : "the next rotation";
    elements["rotation-label"].textContent = `${rotation?.label || "Current specials"} - in cabinet until ${end}`;
  }

  function flavourOption(flavour, text = "") {
    const option = document.createElement("option");
    option.value = flavour.id;
    option.textContent = text || `${flavour.kind === "special" ? "★ " : ""}${flavour.name}`;
    return option;
  }

  function fillFlavourSelect(select, {placeholder, available = flavours, recommended = [], recommendationLabel = "Recommended"}) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    const recommendedIds = new Set(recommended.map(item => item.flavour.id));
    const nodes = [placeholderOption];

    if (recommended.length) {
      const recommendedGroup = document.createElement("optgroup");
      recommendedGroup.label = recommendationLabel;
      recommended.forEach((item, index) => {
        const level = verdictLevel(item.score, item.size || 2);
        recommendedGroup.append(flavourOption(item.flavour, `${index + 1}. ${item.flavour.name} - ${level}`));
      });
      nodes.push(recommendedGroup);
    }

    const classicGroup = document.createElement("optgroup");
    classicGroup.label = recommended.length ? "All other classic flavours" : "Classic flavours";
    const specialGroup = document.createElement("optgroup");
    specialGroup.label = recommended.length ? "All other current specials" : (rotation?.label || "Current specials");
    available.filter(flavour => !recommendedIds.has(flavour.id)).forEach(flavour => {
      (flavour.kind === "special" ? specialGroup : classicGroup).append(flavourOption(flavour));
    });
    if (classicGroup.children.length) nodes.push(classicGroup);
    if (specialGroup.children.length) nodes.push(specialGroup);
    select.replaceChildren(...nodes);
  }

  function buildFlavourSelects() {
    fillFlavourSelect(elements["anchor-select"], {placeholder: "Choose a flavour"});
  }

  function rebuildPartnerSelects() {
    const anchor = flavourById.get(state.anchorId);
    const second = flavourById.get(state.secondId);
    const availableSecond = flavours.filter(flavour => flavour.id !== state.anchorId && (state.mode !== "3" || flavour.id !== state.thirdId));
    const recommendedSecond = anchor
      ? twoScoopRecommendations(anchor).map(result => ({flavour: result.flavours[1], score: result.score, size: 2}))
      : [];
    fillFlavourSelect(elements["second-select"], {
      placeholder: state.mode === "3" ? "Recommend a bridge for me" : "Recommend a partner for me",
      available: availableSecond,
      recommended: recommendedSecond,
      recommendationLabel: anchor ? `Recommended for ${anchor.name}` : "Recommended"
    });

    const completion = anchor && second ? thirdScoopRecommendations(anchor, second) : {results: []};
    fillFlavourSelect(elements["third-select"], {
      placeholder: "Recommend a lift for me",
      available: flavours.filter(flavour => flavour.id !== state.anchorId && flavour.id !== state.secondId),
      recommended: completion.results.map(result => ({flavour: result.flavours[2], score: result.score, size: 3})),
      recommendationLabel: "Recommended lifts for this pair"
    });
  }

  function selectedCup() {
    const ids = [state.anchorId, state.secondId];
    if (state.mode === "3") ids.push(state.thirdId);
    return ids.filter(Boolean).map(id => flavourById.get(id)).filter(Boolean);
  }

  function syncBuilder() {
    rebuildPartnerSelects();
    elements["third-field"].hidden = state.mode !== "3";
    elements["second-role-name"].textContent = state.mode === "3" ? "Bridge" : "Partner";
    elements["second-role-help"].textContent = state.mode === "3" ? "A connecting note between anchor and lift" : "A bridge or lift for your anchor";
    elements["anchor-select"].value = state.anchorId;
    elements["second-select"].value = state.secondId;
    elements["third-select"].value = state.thirdId;
    elements["second-select"].disabled = !state.anchorId;
    elements["third-select"].disabled = !state.secondId;
    elements["clear-cup"].disabled = !state.secondId && !state.thirdId;
    if (!state.secondId) {
      elements["builder-hint"].textContent = state.mode === "3"
        ? "Leave both slots open for complete cup ideas, or choose a bridge to get feedback and ranked lifts."
        : "Leave the second scoop open to see ranked pairings.";
    } else if (state.mode === "2") {
      elements["builder-hint"].textContent = "We will assess your pair and show which third scoop would complete it.";
    } else if (!state.thirdId) {
      elements["builder-hint"].textContent = "We will assess this pair and rank the best lifts for it.";
    } else {
      elements["builder-hint"].textContent = "Your full cup is selected. The verdict on balance and weak links is on the right.";
    }
  }

  function manualPair(a, b) {
    const directIndex = (a.pairs || []).findIndex(pair => pair.id === b.id);
    if (directIndex >= 0) return {rank: directIndex, why: a.pairs[directIndex].why};
    const reverseIndex = (b.pairs || []).findIndex(pair => pair.id === a.id);
    if (reverseIndex >= 0) return {rank: reverseIndex, why: b.pairs[reverseIndex].why};
    return null;
  }

  function sharedSpecificTags(a, b) {
    return a.tags.filter(tag => b.tags.includes(tag) && !GENERIC_TAGS.has(tag));
  }

  function affinityBonus(a, b) {
    let bonus = 0;
    AFFINITIES.forEach(([left, right, value]) => {
      if ((hasAny(a, left) && hasAny(b, right)) || (hasAny(a, right) && hasAny(b, left))) bonus = Math.max(bonus, value);
    });
    return bonus;
  }

  function pairScore(a, b, style = "balanced") {
    if (!a || !b || a.id === b.id) return -Infinity;
    let score = 43;
    const manual = manualPair(a, b);
    if (manual) score += 22 - manual.rank * 2.5;

    const shared = sharedSpecificTags(a, b);
    score += Math.min(shared.length * 3.5, 10);
    score += affinityBonus(a, b);

    const richnessGap = Math.abs(a.profile.richness - b.profile.richness);
    const brightnessGap = Math.abs(a.profile.brightness - b.profile.brightness);
    const hasRich = Math.max(a.profile.richness, b.profile.richness) >= 4;
    const hasBright = Math.max(a.profile.brightness, b.profile.brightness) >= 3;
    if (hasRich && hasBright) score += 10;
    if (Math.max(a.profile.roast, b.profile.roast) >= 4 && Math.max(a.profile.sweetness, b.profile.sweetness) >= 4) score += 4;
    if (a.family === b.family) score += 2;
    if (isSorbet(a) !== isSorbet(b)) score += 3;

    if (style === "contrast") {
      score += richnessGap * 2 + brightnessGap * 1.8;
      if (a.family !== b.family) score += 5;
      score -= shared.length * 1.5;
    } else if (style === "echo") {
      score += shared.length * 4;
      if (a.family === b.family) score += 9;
      score -= richnessGap;
      score -= brightnessGap * 0.5;
    } else if (style === "indulgent") {
      score += (a.profile.richness + b.profile.richness) * 1.5;
      score += (a.profile.sweetness + b.profile.sweetness) * 0.8;
      if (isSorbet(a) || isSorbet(b)) score -= 3;
    } else if (style === "fruit") {
      if (hasAny(a, FRUIT_TAGS)) score += 5;
      if (hasAny(b, FRUIT_TAGS)) score += 5;
      score += Math.max(a.profile.brightness, b.profile.brightness);
    }

    if (style === "balanced" && a.profile.richness >= 5 && b.profile.richness >= 5 && a.profile.brightness < 2 && b.profile.brightness < 2) score -= 9;
    if (style === "balanced" && a.profile.sweetness >= 5 && b.profile.sweetness >= 5 && !hasBright) score -= 6;
    return clamp(score, 20, 98);
  }

  function pairReason(a, b) {
    const manual = manualPair(a, b);
    if (manual) return manual.why;

    const aFruit = hasAny(a, FRUIT_TAGS);
    const bFruit = hasAny(b, FRUIT_TAGS);
    const aChocolate = hasAny(a, CHOCOLATE_TAGS);
    const bChocolate = hasAny(b, CHOCOLATE_TAGS);
    const aNut = hasAny(a, NUT_TAGS);
    const bNut = hasAny(b, NUT_TAGS);
    const aCoffee = a.tags.some(tag => ["coffee", "espresso", "roast"].includes(tag));
    const bCoffee = b.tags.some(tag => ["coffee", "espresso", "roast"].includes(tag));
    const shared = sharedSpecificTags(a, b);

    if ((aChocolate && bFruit) || (bChocolate && aFruit)) return "Fruit and acidity sharpen the chocolate rather than simply sweetening it.";
    if ((aNut && bFruit) || (bNut && aFruit)) return "Bright fruit lifts the roasted nut and praline notes.";
    if ((aChocolate && bNut) || (bChocolate && aNut)) return "Chocolate and roasted nut meet through a familiar praline bridge.";
    if ((aCoffee && hasAny(b, CARAMEL_TAGS)) || (bCoffee && hasAny(a, CARAMEL_TAGS))) return "Roast and bitterness keep the caramel finish in check.";
    if (Math.max(a.profile.richness, b.profile.richness) >= 4 && Math.max(a.profile.brightness, b.profile.brightness) >= 3) return "One scoop carries the weight; the other supplies the palate reset.";
    if (shared.length) return `The shared ${shared[0]} note makes the pairing feel deliberate.`;
    if (a.family === b.family) return `A same-family pairing that explores two sides of ${familyLabel(a.family).toLowerCase()}.`;
    return "Different flavour families, linked by comparable intensity and a clean finish.";
  }

  function familyLabel(family) {
    return ({bright: "fruit and tang", tropical: "tropical aroma", chocolate: "chocolate and roast", nut: "nut and praline", custard: "custard and caramel", bakery: "biscuit and crunch"})[family] || family;
  }

  function pairLabel(score) {
    return `${verdictLevel(score, 2)} combination`;
  }

  function verdictLevel(score, size) {
    const thresholds = size === 3 ? [104, 94, 84, 74] : [86, 76, 67, 58];
    if (score >= thresholds[0]) return "Exceptional";
    if (score >= thresholds[1]) return "Excellent";
    if (score >= thresholds[2]) return "Strong";
    if (score >= thresholds[3]) return "Good";
    return "Adventurous";
  }

  function deterministicJitter(id) {
    if (!state.shuffleSeed) return 0;
    return (Math.abs(hash(`${id}-${state.shuffleSeed}`)) % 700) / 100;
  }

  function twoScoopRecommendations(anchor) {
    const style = state.styles["2"];
    let ranked = flavours
      .filter(flavour => flavour.id !== anchor.id)
      .map(flavour => ({
        flavours: [anchor, flavour],
        score: pairScore(anchor, flavour, style),
        reason: pairReason(anchor, flavour)
      }))
      .sort((a, b) => (b.score + deterministicJitter(b.flavours[1].id)) - (a.score + deterministicJitter(a.flavours[1].id)));

    ranked = promotePreferred(ranked);
    return ranked.slice(0, 4);
  }

  function triadPassesMode(cup, style) {
    const sorbets = cup.filter(isSorbet).length;
    const fruitCount = cup.filter(flavour => hasAny(flavour, FRUIT_TAGS)).length;
    const averageRichness = cup.reduce((sum, flavour) => sum + flavour.profile.richness, 0) / cup.length;
    if (style === "creamy-sorbet") return sorbets === 1;
    if (style === "no-sorbet") return sorbets === 0;
    if (style === "fruit") return fruitCount >= 2 && sorbets >= 1;
    if (style === "indulgent") return averageRichness >= 3.5;
    return true;
  }

  function triadScore(cup, style) {
    const pairScores = [
      pairScore(cup[0], cup[1], style),
      pairScore(cup[0], cup[2], style),
      pairScore(cup[1], cup[2], style)
    ];
    let score = pairScores.reduce((sum, value) => sum + value, 0) / 3;
    score += Math.min(...pairScores) * 0.12;

    const sorbets = cup.filter(isSorbet).length;
    const families = new Set(cup.map(flavour => flavour.family)).size;
    const maxRichness = Math.max(...cup.map(flavour => flavour.profile.richness));
    const maxBrightness = Math.max(...cup.map(flavour => flavour.profile.brightness));
    const fruitCount = cup.filter(flavour => hasAny(flavour, FRUIT_TAGS)).length;
    const averageRichness = cup.reduce((sum, flavour) => sum + flavour.profile.richness, 0) / 3;

    if (style === "balanced") {
      if (sorbets === 1) score += 10;
      if (maxRichness >= 4) score += 5;
      if (maxBrightness >= 3) score += 8;
      score += (families - 1) * 3;
      if (sorbets === 0 && maxBrightness < 2) score -= 7;
    } else if (style === "creamy-sorbet") {
      score += 12;
      if (maxBrightness >= 3) score += 5;
      score += (families - 1) * 2;
    } else if (style === "indulgent") {
      score += averageRichness * 3;
      if (sorbets === 0) score += 7;
      if (cup.some(flavour => hasAny(flavour, CHOCOLATE_TAGS)) && cup.some(flavour => hasAny(flavour, NUT_TAGS) || hasAny(flavour, CARAMEL_TAGS))) score += 7;
    } else if (style === "fruit") {
      score += fruitCount * 6 + maxBrightness * 1.5;
      if (sorbets >= 1) score += 6;
    } else if (style === "no-sorbet") {
      score += 8;
      if (maxBrightness >= 2 || Math.max(...cup.map(flavour => flavour.profile.roast)) >= 4) score += 5;
    }
    return score;
  }

  function threeScoopRecommendations(anchor) {
    const style = state.styles["3"];
    const candidates = flavours.filter(flavour => flavour.id !== anchor.id);
    const ranked = [];
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const partners = [candidates[left], candidates[right]].sort((a, b) => liftValue(a) - liftValue(b));
        const cup = [anchor, partners[0], partners[1]];
        if (!triadPassesMode(cup, style)) continue;
        ranked.push({
          flavours: cup,
          score: triadScore(cup, style),
          reason: triadReason(cup, style)
        });
      }
    }
    ranked.sort((a, b) => (b.score + deterministicJitter(b.flavours.map(item => item.id).join("-"))) - (a.score + deterministicJitter(a.flavours.map(item => item.id).join("-"))));
    const promoted = promotePreferred(ranked);
    const chosen = [];
    const appearances = new Map();
    for (const result of promoted) {
      const partners = result.flavours.filter(flavour => flavour.id !== anchor.id);
      if (partners.some(flavour => (appearances.get(flavour.id) || 0) >= 2) && chosen.length >= 2) continue;
      chosen.push(result);
      partners.forEach(flavour => appearances.set(flavour.id, (appearances.get(flavour.id) || 0) + 1));
      if (chosen.length === 4) break;
    }
    return chosen;
  }

  function promotePreferred(ranked) {
    if (!state.preferredCombo.length) return ranked;
    const preferred = [...state.preferredCombo].sort().join("|");
    const index = ranked.findIndex(result => result.flavours.map(flavour => flavour.id).sort().join("|") === preferred);
    if (index > 0) return [ranked[index], ...ranked.slice(0, index), ...ranked.slice(index + 1)];
    return ranked;
  }

  function assignRoles(cup) {
    if (cup.length === 2) {
      const partner = cup[1];
      const role = partner.profile.brightness >= 3 ? "lift" : sharedSpecificTags(cup[0], partner).length ? "bridge" : "contrast";
      return [{flavour: cup[0], role: "anchor"}, {flavour: partner, role}];
    }
    return [
      {flavour: cup[0], role: "anchor"},
      {flavour: cup[1], role: "bridge"},
      {flavour: cup[2], role: "lift"}
    ];
  }

  function liftValue(flavour) {
    const fresh = flavour.tags.some(tag => ["fresh", "acidic", "bitter", "mint"].includes(tag)) ? 3 : 0;
    return flavour.profile.brightness * 2 + flavour.profile.roast * 0.45 + fresh;
  }

  function triadReason(cup, style) {
    const roles = assignRoles(cup);
    const anchor = roles.find(item => item.role === "anchor").flavour;
    const bridge = roles.find(item => item.role === "bridge").flavour;
    const lift = roles.find(item => item.role === "lift").flavour;
    const bridgeTags = [...sharedSpecificTags(bridge, anchor), ...sharedSpecificTags(bridge, lift)];
    const bridgePhrase = bridgeTags[0] ? `links the cup through ${bridgeTags[0]}` : "gives the cup a softer middle";
    let liftPhrase = "keeps the finish moving";
    if (lift.tags.includes("citrus") || lift.tags.includes("lemon")) liftPhrase = "finishes with bitter citrus";
    else if (hasAny(lift, FRUIT_TAGS) && lift.profile.brightness >= 3) liftPhrase = "supplies the fruit-and-acid reset";
    else if (lift.tags.includes("coffee") || lift.tags.includes("espresso")) liftPhrase = "finishes on espresso bitterness";
    else if (lift.tags.includes("mint")) liftPhrase = "adds a cool, fresh finish";
    else if (lift.profile.roast >= 4) liftPhrase = "adds a dry roasted finish";
    const prefix = style === "indulgent" ? "A deliberately rich cup" : style === "fruit" ? "A fruit-led cup" : "A complete cup";
    return `${prefix}: ${anchor.name} carries the weight, ${bridge.name} ${bridgePhrase}, and ${lift.name} ${liftPhrase}.`;
  }

  function triadLabel(score) {
    return `${verdictLevel(score, 3)} combination`;
  }

  function feedbackNotes(cup, style) {
    if (cup.length === 2) {
      const [first, second] = cup;
      const notes = [];
      const bothRich = first.profile.richness >= 4 && second.profile.richness >= 4;
      const brightest = Math.max(first.profile.brightness, second.profile.brightness);
      const bothSweet = first.profile.sweetness >= 4 && second.profile.sweetness >= 4;
      if (isSorbet(first) !== isSorbet(second)) notes.push("Creamy weight and a sorbet reset give this pair a naturally useful rhythm.");
      else if (isSorbet(first) && isSorbet(second)) notes.push("This will be clean and refreshing, but deliberately lighter on creamy depth.");
      else if (bothRich && brightest < 2) notes.push("Both scoops are dense and low-acid. Deliciously indulgent, but a full serve may become tiring.");
      if (first.family === second.family) notes.push(`The shared ${familyLabel(first.family).toLowerCase()} lane is coherent, though narrower than a contrast pairing.`);
      else if (bothSweet && brightest < 2 && Math.max(first.profile.roast, second.profile.roast) < 4) notes.push("There is little acid or roast to restrain the sweetness, so keep the cup small or add a brighter third.");
      else if (Math.max(first.profile.richness, second.profile.richness) >= 4 && brightest >= 3) notes.push("The pair has a clear anchor and lift rather than two flavours competing for the same job.");
      if (!notes.length) notes.push("The intensities are compatible and neither scoop should erase the other.");
      return notes.slice(0, 2);
    }

    const notes = [];
    const sorbets = cup.filter(isSorbet).length;
    const families = new Set(cup.map(flavour => flavour.family)).size;
    const brightest = Math.max(...cup.map(flavour => flavour.profile.brightness));
    const richest = Math.max(...cup.map(flavour => flavour.profile.richness));
    const averageRichness = cup.reduce((sum, flavour) => sum + flavour.profile.richness, 0) / 3;
    const averageSweetness = cup.reduce((sum, flavour) => sum + flavour.profile.sweetness, 0) / 3;
    const pairs = [
      [cup[0], cup[1]], [cup[0], cup[2]], [cup[1], cup[2]]
    ].map(pair => ({pair, score: pairScore(pair[0], pair[1], "balanced")})).sort((a, b) => a.score - b.score);

    if (!triadPassesMode(cup, style)) {
      const styleName = STYLE_OPTIONS["3"].find(option => option.id === style)?.label || style;
      notes.push(`This is a valid personal choice, but it does not match the selected “${styleName}” brief.`);
    }
    if (sorbets === 1 && richest >= 4 && brightest >= 3) notes.push("The cup has the classic two-creamy, one-lift shape: richness, bridge, and reset.");
    else if (sorbets === 0 && averageRichness >= 4 && brightest < 2) notes.push("All three scoops sit in the rich, low-acid zone. Expect an enveloping cup rather than a refreshing one.");
    else if (sorbets >= 2) notes.push("This is fruit-led and clean; the creamy scoop, if present, will read as an accent rather than the centre.");
    if (families === 1) notes.push("All three flavours occupy one family. The cup is coherent but risks tasting repetitive by the final spoonful.");
    else if (averageSweetness >= 4.4 && brightest < 2 && Math.max(...cup.map(flavour => flavour.profile.roast)) < 4) notes.push("Sweetness is the dominant through-line, with little acid or roast to provide punctuation.");
    if (pairs[0].score < 64) notes.push(`${pairs[0].pair[0].name} and ${pairs[0].pair[1].name} form the weakest edge; alternate them through the third scoop rather than eating them together.`);
    if (!notes.length) notes.push("The cup covers more than one flavour family without an obvious weak link.");
    return notes.slice(0, 3);
  }

  function thirdScoopRecommendations(first, second) {
    const style = state.mode === "3" ? state.styles["3"] : "balanced";
    const all = flavours
      .filter(flavour => flavour.id !== first.id && flavour.id !== second.id)
      .map(flavour => {
        const cup = [first, second, flavour];
        return {flavours: cup, score: triadScore(cup, style), reason: triadReason(cup, style)};
      })
      .sort((a, b) => b.score - a.score);
    const matching = all.filter(result => triadPassesMode(result.flavours, style));
    return {results: (matching.length ? matching : all).slice(0, 4), relaxed: matching.length === 0};
  }

  function cupVisual(cup) {
    const visual = document.createElement("div");
    visual.className = `cup-visual ${cup.length === 2 ? "two" : "three"}`;
    cup.forEach(flavour => {
      const scoop = document.createElement("span");
      scoop.className = `cup-scoop flavour-colour-${flavour.family}`;
      visual.append(scoop);
    });
    return visual;
  }

  function assessmentCard(cup) {
    const style = cup.length === 2 ? state.styles["2"] : state.styles["3"];
    const score = cup.length === 2 ? pairScore(cup[0], cup[1], style) : triadScore(cup, style);
    const label = cup.length === 2 ? pairLabel(score) : triadLabel(score);
    const reason = cup.length === 2 ? pairReason(cup[0], cup[1]) : triadReason(cup, style);
    const roles = assignRoles(cup);
    const card = document.createElement("article");
    card.className = "assessment-card";

    const copy = document.createElement("div");
    copy.className = "assessment-copy";
    copy.innerHTML = `
      <p class="assessment-kicker">Your selected ${cup.length === 2 ? "pair" : "cup"}</p>
      <h4>${escapeHtml(cup.map(flavour => flavour.name).join(" + "))}</h4>
      <p class="assessment-verdict">${escapeHtml(label)}</p>
      <p class="reason">${escapeHtml(reason)}</p>
      <ul class="feedback-list">${feedbackNotes(cup, style).map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      <div class="role-row">${roles.map(item => `<span class="role-tag">${escapeHtml(item.flavour.name)} - ${item.role}</span>`).join("")}</div>`;

    const share = document.createElement("button");
    share.type = "button";
    share.className = "share-button";
    share.textContent = "Share this cup";
    share.addEventListener("click", () => shareCup(cup));
    card.append(cupVisual(cup), copy, share);
    return card;
  }

  function renderMode() {
    elements.modeButtons.forEach(button => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderStyleOptions();
    syncBuilder();
    renderAnchorSummary();
    renderResults();
    writeUrlState();
  }

  function renderStyleOptions() {
    elements["style-options"].replaceChildren();
    const anchor = flavourById.get(state.anchorId);
    STYLE_OPTIONS[state.mode].forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "style-chip";
      button.textContent = option.label;
      button.dataset.style = option.id;
      const active = state.styles[state.mode] === option.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      if (option.id === "no-sorbet" && anchor && isSorbet(anchor)) {
        button.disabled = true;
        button.title = "Choose a gelato first to use No sorbet mode";
      }
      button.addEventListener("click", () => {
        state.styles[state.mode] = option.id;
        state.shuffleSeed = 0;
        state.preferredCombo = [];
        renderStyleOptions();
        renderResults();
        writeUrlState();
      });
      elements["style-options"].append(button);
    });
  }

  function renderAnchorSummary() {
    const anchor = flavourById.get(state.anchorId);
    if (!anchor) {
      elements["anchor-summary"].innerHTML = `
        <div class="empty-scoop" aria-hidden="true">?</div>
        <div><p class="mini-label">First scoop</p><h3>Choose from the cabinet</h3><p>Specials are marked in the list and refreshed each monthly rotation.</p></div>`;
      return;
    }
    const cup = selectedCup();
    if (cup.length > 1) {
      elements["anchor-summary"].innerHTML = `
        <div class="summary-stack ${cup.length === 2 ? "two" : "three"}" aria-hidden="true">
          ${cup.map(flavour => `<span class="flavour-colour-${escapeHtml(flavour.family)}"></span>`).join("")}
        </div>
        <div>
          <p class="mini-label">Your ${cup.length === 2 ? "pair" : "cup"}</p>
          <h3>${escapeHtml(cup.map(flavour => flavour.name).join(" + "))}</h3>
          <p>${cup.length === 2 ? "Pair feedback and suggested third scoops are on the right." : "Full-cup feedback is on the right."}</p>
        </div>`;
      return;
    }
    elements["anchor-summary"].innerHTML = `
      <div class="summary-scoop flavour-colour-${escapeHtml(anchor.family)}" aria-hidden="true"></div>
      <div>
        <p class="mini-label">${anchor.kind === "special" ? "Current special" : anchor.format}</p>
        <h3>${escapeHtml(anchor.name)}</h3>
        <p>${escapeHtml(anchor.note)}</p>
      </div>`;
  }

  function renderResults() {
    const anchor = flavourById.get(state.anchorId);
    if (!anchor) {
      elements["shuffle-results"].disabled = true;
      elements["results-title"].textContent = "Your combinations will appear here.";
      elements.recommendations.innerHTML = `<div class="results-empty"><div class="mini-stack" aria-hidden="true"><i></i><i></i><i></i></div><p>Pick a first scoop to see the strongest current pairings.</p></div>`;
      return;
    }

    const second = flavourById.get(state.secondId);
    const third = flavourById.get(state.thirdId);
    elements["shuffle-results"].disabled = Boolean(second);
    if (second) {
      const pair = [anchor, second];
      if (state.mode === "3" && third) {
        const cup = [anchor, second, third];
        elements["results-title"].textContent = `The verdict on ${cup.map(flavour => flavour.name).join(" + ")}.`;
        elements.recommendations.replaceChildren(assessmentCard(cup));
        return;
      }

      const completion = thirdScoopRecommendations(anchor, second);
      elements["results-title"].textContent = state.mode === "2"
        ? `How ${anchor.name} + ${second.name} works.`
        : `Complete ${anchor.name} + ${second.name}.`;
      const heading = document.createElement("div");
      heading.className = "completion-heading";
      heading.innerHTML = `
        <p class="eyebrow">Suggested third scoops</p>
        <h4>${state.mode === "2" ? "If you decide to make it three." : "The strongest ways to finish this pair."}</h4>
        ${completion.relaxed ? "<p>Your selected style cannot be completed from this pair, so these are the best balanced options instead.</p>" : "<p>Each option is scored as a whole cup, not merely against the first scoop.</p>"}`;
      const cards = completion.results.map((result, index) => recommendationCard(result, index, {
        actionLabel: state.mode === "2" ? "Add this third" : "Choose this third",
        onChoose: () => selectCup(result.flavours)
      }));
      elements.recommendations.replaceChildren(assessmentCard(pair), heading, ...cards);
      return;
    }

    const recommendations = state.mode === "2" ? twoScoopRecommendations(anchor) : threeScoopRecommendations(anchor);
    const styleName = STYLE_OPTIONS[state.mode].find(option => option.id === state.styles[state.mode])?.label.toLowerCase();
    elements["results-title"].textContent = `${state.mode === "2" ? "Two-scoop" : "Three-scoop"} ${styleName} picks for ${anchor.name}.`;
    if (!recommendations.length) {
      elements.recommendations.innerHTML = `<div class="results-empty"><p>That filter cannot start with ${escapeHtml(anchor.name)}. Try a different style or first scoop.</p></div>`;
      return;
    }
    elements.recommendations.replaceChildren(...recommendations.map((result, index) => recommendationCard(result, index, {
      actionLabel: result.flavours.length === 2 ? "Choose this pair" : "Choose this cup",
      onChoose: () => selectCup(result.flavours)
    })));
  }

  function recommendationCard(result, index, options = {}) {
    const card = document.createElement("article");
    card.className = "recommendation-card";
    const roles = assignRoles(result.flavours);

    const copy = document.createElement("div");
    const names = result.flavours.map(flavour => flavour.name).join(" + ");
    const rankLabel = result.flavours.length === 3 ? triadLabel(result.score) : pairLabel(result.score);
    copy.innerHTML = `
      <p class="recommendation-rank">${index === 0 ? "Top recommendation" : escapeHtml(rankLabel)}</p>
      <h4>${escapeHtml(names)}</h4>
      <p class="reason">${escapeHtml(result.reason)}</p>
      <div class="role-row">${roles.map(item => `<span class="role-tag">${escapeHtml(item.flavour.name)} - ${item.role}</span>`).join("")}</div>`;

    const actions = document.createElement("div");
    actions.className = "card-actions";
    if (options.onChoose) {
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "choose-button";
      choose.textContent = options.actionLabel || "Choose cup";
      choose.addEventListener("click", options.onChoose);
      actions.append(choose);
    }
    const share = document.createElement("button");
    share.type = "button";
    share.className = "share-button";
    share.textContent = "Share";
    share.addEventListener("click", () => shareCup(result.flavours));
    actions.append(share);
    card.append(cupVisual(result.flavours), copy, actions);
    return card;
  }

  function renderCabinet() {
    const query = state.cabinetQuery.trim().toLowerCase();
    const visible = flavours.filter(flavour => {
      const searchMatch = !query || `${flavour.name} ${flavour.note} ${flavour.tags.join(" ")}`.toLowerCase().includes(query);
      const filterMatch = state.cabinetFilter === "all"
        || (state.cabinetFilter === "special" && flavour.kind === "special")
        || (state.cabinetFilter === "sorbet" && isSorbet(flavour))
        || (state.cabinetFilter === "creamy" && isCreamy(flavour));
      return searchMatch && filterMatch;
    });
    elements["flavour-grid"].replaceChildren(...visible.map(flavour => flavourCard(flavour)));
    elements["no-flavour-results"].hidden = visible.length > 0;
  }

  function flavourCard(flavour) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `flavour-card flavour-border-${flavour.family}`;
    button.setAttribute("aria-label", `Start with ${flavour.name}. ${flavour.note}`);
    button.innerHTML = `
      <span class="flavour-badges">
        ${flavour.kind === "special" ? '<span class="flavour-badge special">Current special</span>' : '<span class="flavour-badge">Classic</span>'}
        <span class="flavour-badge">${escapeHtml(flavour.format)}</span>
      </span>
      <span><h3>${escapeHtml(flavour.name)}</h3><p>${escapeHtml(flavour.note)}</p></span>
      <span class="make-anchor">Pair this flavour</span>`;
    button.addEventListener("click", () => {
      setAnchor(flavour.id);
      document.getElementById("calculator").scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    });
    return button;
  }

  function setAnchor(id) {
    if (!flavourById.has(id)) return;
    const changed = state.anchorId !== id;
    state.anchorId = id;
    if (changed) {
      state.secondId = "";
      state.thirdId = "";
    }
    state.shuffleSeed = 0;
    state.preferredCombo = [];
    if (isSorbet(flavourById.get(id)) && state.styles["3"] === "no-sorbet") state.styles["3"] = "balanced";
    renderMode();
  }

  function setSecond(id) {
    if (id && (!flavourById.has(id) || id === state.anchorId || id === state.thirdId)) return;
    if (state.secondId !== id) state.thirdId = "";
    state.secondId = id;
    state.shuffleSeed = 0;
    state.preferredCombo = [];
    renderMode();
  }

  function setThird(id) {
    if (id && (!state.secondId || !flavourById.has(id) || id === state.anchorId || id === state.secondId)) return;
    state.thirdId = id;
    state.shuffleSeed = 0;
    state.preferredCombo = [];
    renderMode();
  }

  function selectCup(cup) {
    if (!Array.isArray(cup) || cup.length < 2 || cup.length > 3) return;
    state.mode = String(cup.length);
    state.anchorId = cup[0].id;
    state.secondId = cup[1].id;
    state.thirdId = cup[2]?.id || "";
    state.shuffleSeed = 0;
    state.preferredCombo = [];
    renderMode();
  }

  function randomAnchor() {
    const specials = flavours.filter(flavour => flavour.kind === "special");
    const pool = Math.random() < 0.65 && specials.length ? specials : flavours;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    setAnchor(choice.id);
  }

  async function shareCup(cup) {
    const names = cup.map(flavour => flavour.name).join(" + ");
    const params = new URLSearchParams();
    params.set("mode", String(cup.length));
    params.set("anchor", cup[0].id);
    params.set("style", state.styles[String(cup.length)] || "balanced");
    params.set("combo", cup.map(flavour => flavour.id).join("~"));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shareData = {title: "My Scoop Theory cup", text: `${names} - an unofficial Messina pairing`, url};
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await copyText(`${shareData.text}\n${url}`);
      showToast("Cup link copied");
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Could not copy the link");
    }
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "clipboard-proxy";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2400);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"})[character]);
  }

  function attachEvents() {
    elements.modeButtons.forEach(button => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.shuffleSeed = 0;
      state.preferredCombo = [];
      if (state.mode === "3" && state.styles["3"] === "no-sorbet" && isSorbet(flavourById.get(state.anchorId))) state.styles["3"] = "balanced";
      renderMode();
    }));
    elements["anchor-select"].addEventListener("change", event => setAnchor(event.target.value));
    elements["second-select"].addEventListener("change", event => setSecond(event.target.value));
    elements["third-select"].addEventListener("change", event => setThird(event.target.value));
    elements["clear-cup"].addEventListener("click", () => {
      state.secondId = "";
      state.thirdId = "";
      state.shuffleSeed = 0;
      state.preferredCombo = [];
      renderMode();
    });
    elements["random-anchor"].addEventListener("click", randomAnchor);
    elements["hero-random"].addEventListener("click", () => {
      randomAnchor();
      document.getElementById("calculator").scrollIntoView({behavior: "smooth"});
    });
    elements["shuffle-results"].addEventListener("click", () => {
      state.shuffleSeed += 1;
      state.preferredCombo = [];
      renderResults();
    });
    elements["cabinet-search"].addEventListener("input", event => {
      state.cabinetQuery = event.target.value;
      renderCabinet();
    });
    elements["cabinet-filters"].addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.cabinetFilter = button.dataset.filter;
      [...elements["cabinet-filters"].querySelectorAll("[data-filter]")].forEach(filter => {
        const active = filter === button;
        filter.classList.toggle("is-active", active);
        filter.setAttribute("aria-pressed", String(active));
      });
      renderCabinet();
    });
  }

  async function init() {
    cacheElements();
    try {
      const data = await loadData();
      updateCabinetMeta(data);
      buildFlavourSelects();
      readUrlState();
      if (!state.anchorId) state.anchorId = flavourById.has("cheesecake-chill") ? "cheesecake-chill" : flavours[0]?.id || "";
      attachEvents();
      renderMode();
      renderCabinet();
    } catch (error) {
      console.error(error);
      elements["results-title"].textContent = "The cabinet could not be loaded.";
      elements.recommendations.innerHTML = '<div class="results-empty"><p>Please use the official Messina links below while we refresh the flavour data.</p></div>';
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
