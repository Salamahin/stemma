// Deterministic synthetic family tree for rendering benchmarks.
// Shape mimics real stemmas: several founding lines, married-in spouses as
// roots, 1-4 children per family, surnames inherited from the father so that
// clan clouds appear.
export function syntheticStemma(targetPeople, seed = 42) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const surnames = ["Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов",
    "Новиков", "Морозов", "Волков", "Зайцев", "Павлов", "Семенов", "Голубев", "Орлов"];
  const given = ["Аркадий", "Богдан", "Вадим", "Геннадий", "Добрыня", "Елисей", "Жорж", "Захар",
    "Игнат", "Кирилл", "Лука", "Макар", "Назар", "Олег", "Прохор", "Родион"];
  const people = [];
  const families = [];
  const queue = [];
  const mk = (surname) => {
    const id = `p${people.length}`;
    const name = `${given[Math.floor(rnd() * given.length)]} ${surname}`;
    people.push({ type: "PersonDescription", id, name, readOnly: false, birthDate: "1900-01-01" });
    return { id, surname };
  };
  for (let i = 0; i < 4; i++) queue.push(mk(surnames[i]));
  while (people.length < targetPeople && queue.length) {
    const p = queue.shift();
    if (rnd() < 0.15) continue; // stays single
    const spouse = mk(surnames[Math.floor(rnd() * surnames.length)]);
    const kids = [];
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n && people.length < targetPeople; k++) {
      const c = mk(p.surname);
      kids.push(c.id);
      queue.push(c);
    }
    families.push({ type: "FamilyDescription", id: `f${families.length}`, parents: [p.id, spouse.id], children: kids, readOnly: false });
  }
  return { type: "Stemma", people, families };
}
