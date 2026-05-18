# Audit — Kings of Europe stemma

Snapshot date: 2026-05-18 (post-fix). 318 persons, 80 families.

## Applied fixes (2026-05-17 / 2026-05-18)

- **A3** — deleted 2 duplicate childless FAMILY rows (Елизавета II + Филипп, Вильгельм II + Августа Виктория).
- **A2** — renamed 12 ambiguous-name persons (Анна Иоанновна, Анна Петровна, Иоанн V, Алексей Петрович (царевич), Фёдор III Алексеевич, Елизавета Петровна, Софья Алексеевна, Екатерина Иоанновна, two Павла Петровичей, two Петра Петровичей).
- **B1–B6, C1–C4** — added 31 missing children + linked 1 existing person (Анна-Мария) to her parents.
- **C5** — added Ольга Фёдоровна + 6 Mikhail-Nikolaevich children (Sandro's siblings) + 1 new family connecting Sandro to his parents.
- **C6–C8** — added 3 Sandro-like links: Августа Саксен-Веймарская to her mother Мария Павловна (via new Karl Friedrich SW); Фридерика Ганноверская to her mother Виктория Луиза (via new Ernst August III Brunswick); Александрина и Цецилия Мекленбург to their mother Анастасия Михайловна (via new Friedrich Franz III Mecklenburg).
- **Bio rewrite** — every non-infant person now has a 200–600 char anecdotal bio (origin, marriage, scandal, historical fact). Infant deaths kept as one-line factual notes (year of death + burial location).

## Remaining open items

### A1 — disconnected component (not fixed)
`components.md` still shows 2 components. Component 2 is **Кароль I Румынский + Елизавета Вид-Нойвидская**, isolated — they have no surviving children, and the Hohenzollern-Sigmaringen bridge to Ferdinand I (nephew) was not built since it requires non-royal-line intermediates.

## A. Structural — original audit (most resolved)

### A1. Disconnected component — *still open*
Component 2 is just **Кароль I Румынский + Елизавета Вид-Нойвидская**, isolated. They have no surviving children, and the rest of the Romanian royals (Фердинанд I, Кароль II, Михай I, …) belong to component 1. Carol I was Ferdinand I's uncle (brother of Leopold of Hohenzollern‑Sigmaringen); the bridge persons (Leopold + Antonia of Portugal + their parents Karl Anton + Joséphine of Baden) are not in the tree, so the connection cannot be made without adding them. **Not applied.**

### A2. Same-name persons (not duplicates, just ambiguous labels)
Each pair below is two distinct historical figures, but the display name doesn't disambiguate. Suggested renames:

| Current name | pid | Dates | Should be |
|---|---|---|---|
| Анна | bf77f90f… | 1708-1728 | **Анна Петровна** |
| Анна | e3867e41… | 1693-1740 | **Анна Иоанновна (императрица)** |
| Иоанн | 94dc5629… | 1666-1696 | **Иоанн V Алексеевич** |
| Алексей | c3c8afab… | 1690-1718 | **Алексей Петрович (царевич)** |
| Федор | c85911fc… | 1661-1682 | **Фёдор III Алексеевич** |
| Елизавета | 3f7b4746… | 1709-1762 | **Елизавета Петровна (императрица)** |
| Софья | 85db0545… | 1657-1704 | **Софья Алексеевна (регент)** |
| Екатерина | 22107fb7… | 1691-1733 | **Екатерина Иоанновна** |
| Павел Петрович | 3640c614… | 1693-1693 | **Павел Петрович (1693)** |
| Павел Петрович | e5661e8d… | 1717-1717 | **Павел Петрович (1717)** |
| Пётр Петрович | 9461cfda… | 1715-1719 | **Пётр Петрович (1715–1719)** |
| Пётр Петрович | cf50a429… | 1723-1723 | **Пётр Петрович (1723)** |

### A3. Duplicate childless families — fixed 2026-05-17
Two pairs of FAMILY rows shared identical parent sets; the empty-children twin in each was the leftover. Deleted:

- `FAMILY#73511b20…` (Елизавета II + Филипп, 0 children)
- `FAMILY#0c76b1c5…` (Вильгельм II + Августа Виктория, 0 children)

## B. Missing children (childless-but-shouldn't-be)

For each of these, the family row exists with 0 children, but the couple historically had children who are not in the tree. Add the missing persons + link them to the family.

### B1. Эдвард, герцог Эдинбургский + Софи (fid `a332a5bb…`)
Historically 2 children — both absent:
- **Lady Louise Windsor** (b. 2003-11-08)
- **James, Earl of Wessex** (b. 2007-12-17)

### B2. Павлос, наследный принц Греческий + Мари-Шанталь Миллер (fid `0818d75c…`)
Historically 5 children — all absent:
- **Принцесса Мария-Олимпия Греческая** (b. 1996-07-25)
- **Принц Константин-Алексиос Греческий** (b. 1998-10-29)
- **Принц Ахиллеас-Андреас Греческий** (b. 2000-08-12)
- **Принц Одиссеас-Кимон Греческий** (b. 2004-09-17)
- **Принц Аристидис-Ставрос Греческий** (b. 2008-06-29)

### B3. Михаил Александрович + Наталья Брасова (fid `bbc3a8cb…`)
Historically 1 son — absent:
- **Георгий Михайлович (граф Брасов)** (1910-07-24 – 1931-07-21)

### B4. Ксения Александровна + Александр Михайлович (Сандро) (fid `fd01d2bf…`)
Historically 7 children — all absent:
- **Ирина Александровна** (1895-07-15 – 1970-02-26) — жена Феликса Юсупова
- **Андрей Александрович** (1897-01-24 – 1981-05-08)
- **Феодор Александрович** (1898-12-23 – 1968-11-30)
- **Никита Александрович** (1900-01-16 – 1974-09-12)
- **Дмитрий Александрович** (1901-08-15 – 1980-07-07)
- **Ростислав Александрович** (1902-11-24 – 1978-07-31)
- **Василий Александрович** (1907-07-07 – 1989-06-24)

### B5. Вильгельм, кронпринц Германский + Цецилия Мекленбург-Шверинская (fid `301f4ba1…`)
Historically 6 children — all absent:
- **Принц Вильгельм Прусский** (1906-07-04 – 1940-05-26)
- **Принц Луи-Фердинанд Прусский** (1907-11-09 – 1994-09-25)
- **Принц Губертус Прусский** (1909-09-30 – 1950-04-08)
- **Принц Фридрих Прусский** (1911-12-19 – 1966-04-10)
- **Принцесса Александрина Прусская** (1915-04-07 – 1980-10-02)
- **Принцесса Цецилия Прусская** (1917-09-05 – 1975-04-21)

### B6. Вильгельм I Вюртембергский + Екатерина Павловна (fid `206dbb8e…`)
Historically 2 daughters — both absent:
- **Мария Фридерика Шарлотта Вюртембергская** (1816-10-30 – 1887-01-04)
- **София Вюртембергская** (1818-06-17 – 1877-06-03) — королева-консорт Нидерландов (жена Виллема III)

## C. Missing co-parent / re-marriage children

### C1. Фредерик IX Датский + Ингрид Шведская (current children: Margrethe II only)
Historically 3 daughters. Add:
- **Принцесса Бенедикта Датская** (b. 1944-04-29)
- **Анна-Мария Датская** (b. 1946-08-30) — **she already exists in the tree** (pid `3ff338df…`, married to Konstantin II Greek). Just add her to this family's children list.

### C2. Олаф V + Марта Шведская (current children: Harald V only)
Historically 3 children. Add:
- **Принцесса Рагнхильда Норвежская** (1930-06-09 – 2012-09-16)
- **Принцесса Астрид Норвежская** (b. 1932-02-12)

### C3. Альфонсо XII Испанский + Мария Кристина Австрийская (current children: Alfonso XIII only)
Historically 3 children. Add:
- **Мария де лас Мерседес, принцесса Астурийская** (1880-09-11 – 1904-10-17)
- **Мария Тереса Испанская** (1882-11-12 – 1912-09-23)

### C4. Виктория Гессенская + Людвиг Александр Баттенберг (current children: Alice only)
Historically 4 children. Add:
- **Луиза Маунтбеттен** (1889-07-13 – 1965-03-07) — королева-консорт Швеции (жена Густава VI Адольфа)
- **Джордж Маунтбеттен (маркиз Милфорд-Хейвен)** (1892-11-06 – 1938-04-08)
- **Луи Маунтбеттен (граф Маунтбеттен Бирманский)** (1900-06-25 – 1979-08-27)

### C5. Михаил Николаевич (отец Сандро) — *no family in DB*
**Александр Михайлович (Сандро)** is in the tree but disconnected from his parents. Historically son of Mikhail Nikolaevich + Ольга Фёдоровна (Cecilie of Baden). Mikhail Nikolaevich is in the tree as a child of Nicholas I; he has no family row. To link Sandro, need to add Ольга Фёдоровна + a family `Михаил Николаевич + Ольга Фёдоровна → Александр Михайлович`. The other 6 children of this couple (Anastasia, Nikolai Mikhailovich, Mikhail Mikhailovich, George Mikhailovich, Sergei Mikhailovich, Alexei Mikhailovich) are not in the tree — optional to add.

## D. Already-correct childless families (leave alone)

These have 0 children **and that's historically accurate**:

- Кароль I Румынский + Елизавета Вид-Нойвидская — one daughter (Marie), died at 3; effectively childless line.
- Александр I + Елизавета Алексеевна — 2 daughters died in infancy (could optionally be added).
- Анна Иоанновна + Фридрих Вильгельм Курляндский — childless (he died months after wedding).
- Михаил Фёдорович Романов + Мария Долгорукова — childless (she died young).
- Павел I + Наталья Алексеевна — childless (she died in childbirth).
- Эдуард VIII + Уоллис Симпсон — childless.
- Карл III + Камилла — childless together.
- Сергей Александрович + Елизавета Фёдоровна — childless.

## E. Sanity checks — clean
- No dangling pid references.
- No family with <2 parents.
- No date paradoxes (parent born after child, parent died >9 months before child birth).
- No person appears as a child in more than one family.

## Proposed fix order

1. **A2 renames** — pure metadata, safe, no structural change.
2. **B1–B6 + C1–C4 adds** — add the new PERSON rows, then update each FAMILY's `children` list to include them.
3. **C5 (Sandro's parent link)** — optional; requires adding Ольга Фёдоровна.
4. **A1 (Carol I bridge)** — optional; would need adding Leopold of Hohenzollern + Antonia of Portugal + Ferdinand's actual parents family.
