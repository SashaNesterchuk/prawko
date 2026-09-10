"""Country packs for explanation rewrites. Add SK/PL by filling a pack, not by forking the CLI."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORKSPACE = REPO.parent


@dataclass(frozen=True)
class LawSource:
    id: str
    title: str
    short_cite: str
    urls: tuple[str, ...]


@dataclass(frozen=True)
class CountryPack:
    code: str
    question_set_key: str
    locale: str
    write_locales: tuple[str, ...]
    protected_locales: tuple[str, ...]
    explanation_version: str
    # Skipped only with --skip-reviewed. Default rewrite includes these too.
    keep_explanation_versions: tuple[str, ...]
    sign_catalog_path: Path
    media_env_key: str
    media_local_roots: tuple[Path, ...]
    law_sources: tuple[LawSource, ...]
    paragraph_marker: str
    citation_example: str
    start_correct: str
    start_yes: str
    start_no: str
    sign_word: str
    causal_words: tuple[str, ...]
    banned_phrases: tuple[str, ...]
    generic_prompt_re: str
    # Extra prompt shapes for --rerun visual (picture is the exam item).
    scene_prompt_re: str = ""
    topic_query_extra: dict[str, str] = field(default_factory=dict)
    min_chars: int = 130
    max_chars: int = 560


CZ_PACK = CountryPack(
    code="CZ",
    question_set_key="cz-v2-current",
    locale="cs",
    write_locales=("cs", "en"),
    protected_locales=(),
    explanation_version="cz-learner-explanation-v1",
    keep_explanation_versions=("cz-manual-explanation-v1",),
    sign_catalog_path=REPO / "data" / "cz-road-signs-dopravni-znaceni-eu" / "manifest.json",
    media_env_key="EXPO_PUBLIC_CZECH_MEDIA_BASE_URL",
    media_local_roots=(
        WORKSPACE / "czech-etesty-questions-2026-08-19" / "czech-media-prod",
        WORKSPACE / "czech-etesty-questions-2026-08-19" / "media-opt",
        WORKSPACE / "czech-etesty-questions-2026-08-19" / "media",
    ),
    law_sources=(
        LawSource(
            id="361-2000",
            title="zákon č. 361/2000 Sb., o provozu na pozemních komunikacích",
            short_cite="zákona č. 361/2000 Sb.",
            urls=(
                "https://www.zakonyprolidi.cz/cs/2000-361",
                "https://www.zakonyprolidi.cz/print/cs/2000-361.htm",
            ),
        ),
        LawSource(
            id="294-2015",
            title="vyhláška č. 294/2015 Sb., kterou se provádějí pravidla provozu",
            short_cite="vyhlášky č. 294/2015 Sb.",
            urls=("https://www.zakonyprolidi.cz/cs/2015-294",),
        ),
        LawSource(
            id="56-2001",
            title="zákon č. 56/2001 Sb., o podmínkách provozu vozidel na pozemních komunikacích",
            short_cite="zákona č. 56/2001 Sb.",
            urls=("https://www.zakonyprolidi.cz/cs/2001-56",),
        ),
    ),
    paragraph_marker=r"§",
    citation_example="§ 27 odst. 1 zákona č. 361/2000 Sb.",
    start_correct="Správně je {letter}.",
    start_yes="Správně je ano.",
    start_no="Správně je ne.",
    sign_word="značk",
    causal_words=("protože", "neboť", "jelikož", "proto ", "a proto", "tím pádem", "kvůli"),
    banned_phrases=(
        "odpovídá pravidlu pro tuto situaci",
        "neodpovídá povinnosti nebo omezení",
        "v situaci „",
        "v situaci \"",
        "situace vyplývá z oficiálního zadání",
        "this conclusion follows",
        "applies the governing rule",
        "does not meet the duty or restriction",
        "odpověď vyplývá",
        "správná volba",
    ),
    generic_prompt_re=r"(?is)jak se zachováte|v této situaci|z výhledu|za (první |touto |nejbližší )",
    scene_prompt_re=r"(?is)vyobrazen|na obrázku",
    topic_query_extra={
        "intersections_priority": "přednost křižovatka hlavní vedlejší kruhový objezd znamení",
        "signs_signals": "dopravní značka světelná signalizace stůj volno",
        "driving_maneuvers": "předjíždění odbočování otáčení jízdní pruh objíždění",
        "attention_risks": "ohrozit omezit připojovací pruh bezpečná vzdálenost",
        "documents_responsibility": "řidičské oprávnění skupina karta řidiče přestupek",
        "vehicle_equipment": "technická prohlídka STK provozní hmoty výrobce",
        "accidents_first_aid": "první pomoc zranění páteř mícha vědomí",
    },
)


SK_PACK = CountryPack(
    code="SK",
    question_set_key="sk-v2-current",
    locale="sk",
    write_locales=("sk",),
    protected_locales=(),
    explanation_version="sk-learner-explanation-v1",
    keep_explanation_versions=(),
    sign_catalog_path=REPO / "data" / "sk-road-signs-wikimedia" / "manifest.json",
    media_env_key="EXPO_PUBLIC_SLOVAK_MEDIA_BASE_URL",
    media_local_roots=(
        REPO / "data" / "sk-questions-vodicak" / "media",
        WORKSPACE / "slovak-question-media",
    ),
    law_sources=(
        LawSource(
            id="8-2009",
            title="zákon č. 8/2009 Z. z. o cestnej premávke",
            short_cite="zákona č. 8/2009 Z. z.",
            urls=(
                "https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2009/8/html",
                "https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2009/8/html",
            ),
        ),
        LawSource(
            id="30-2020",
            title="vyhláška č. 30/2020 Z. z. o dopravnom značení",
            short_cite="vyhlášky č. 30/2020 Z. z.",
            urls=("https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2020/30/html",),
        ),
    ),
    paragraph_marker=r"§",
    citation_example="§ 22 ods. 1 zákona č. 8/2009 Z. z.",
    start_correct="Správne je {letter}.",
    start_yes="Správne je áno.",
    start_no="Správne je nie.",
    sign_word="značk",
    causal_words=("pretože", "lebo", "keďže", "preto ", "a preto"),
    banned_phrases=(
        "zodpovedá pravidlu pre túto situáciu",
        "v situácii „",
        "oficiálneho zadania",
    ),
    generic_prompt_re=r"(?is)ako sa zachováte|v tejto situácii|z výhľadu",
    scene_prompt_re=r"(?is)vyobrazen|na obrázku|vo vyobrazení",
    topic_query_extra={
        "intersections_priority": "prednosť križovatka hlavná vedľajšia kruhový objazd",
        "signs_signals": "dopravná značka svetelná signalizácia státie voľno",
        "driving_maneuvers": "predchádzanie odbočovanie otáčanie jazdný pruh",
        "attention_risks": "ohroziť obmedziť pripájací pruh bezpečná vzdialenosť",
        "documents_responsibility": "vodičské oprávnenie skupina karta vodiča",
        "vehicle_equipment": "technická kontrola STK prevádzkové hmoty výrobca",
        "accidents_first_aid": "prvá pomoc zranenie chrbtica miecha vedomie",
    },
)


PL_PACK = CountryPack(
    code="PL",
    question_set_key="pl-v2-current",
    locale="pl",
    write_locales=("pl",),
    protected_locales=("ua", "en", "de", "es"),
    explanation_version="pl-learner-explanation-v1",
    keep_explanation_versions=(),
    sign_catalog_path=REPO / "data" / "pl-road-signs-wikimedia" / "manifest.json",
    media_env_key="EXPO_PUBLIC_MEDIA_BASE_URL",
    media_local_roots=(),
    law_sources=(
        LawSource(
            id="prd",
            title="ustawa Prawo o ruchu drogowym",
            short_cite="ustawy – Prawo o ruchu drogowym",
            urls=("https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU19970980602/U/D19970602Lj.pdf",),
        ),
    ),
    paragraph_marker=r"(?:art\.|Art\.)",
    citation_example="art. 25 ust. 1 ustawy – Prawo o ruchu drogowym",
    start_correct="Prawidłowa odpowiedź: {letter}.",
    start_yes="Prawidłowa odpowiedź: tak.",
    start_no="Prawidłowa odpowiedź: nie.",
    sign_word="znak",
    causal_words=("ponieważ", "bo ", "gdyż", "dlatego", "więc "),
    banned_phrases=("odpowiada zasadzie dla tej sytuacji", "w sytuacji „"),
    generic_prompt_re=r"(?is)jak zachowasz się|w tej sytuacji",
    scene_prompt_re=r"(?is)na rysunku|w przedstawionej|na zdjęciu",
)


PACKS = {"cz": CZ_PACK, "sk": SK_PACK, "pl": PL_PACK}


def get_pack(code: str) -> CountryPack:
    pack = PACKS.get(code.strip().lower())
    if pack is None:
        known = ", ".join(sorted(PACKS))
        raise SystemExit(f"Unknown country '{code}'. Known packs: {known}.")
    return pack
