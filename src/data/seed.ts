// Demo data for showing the software to the owner.
// Dates are relative to today so it always looks current.
// Settings → "Reset demo data" restores it; "Clear all data" starts fresh.

import type { Customer, DB, Employee, Expense, InventoryItem, Machine, Order, OrderStatus, Payment, ProductionEntry, Purchase, SalaryRecord, StockEntry, Supplier, SupplierPayment } from '../types';
import { addDays, toISODate } from '../lib/format';
import { motifSVG } from './motifs';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isSunday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
};

export function buildSeed(): DB {
  const r = rng(1118);
  const between = (a: number, b: number) => a + r() * (b - a);
  const round = (n: number, to: number) => Math.round(n / to) * to;
  const T = toISODate(new Date());
  const D = (offset: number) => addDays(T, offset);
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;

  // ---------- Employees ----------
  const empRows: [string, string, number, string][] = [
    ['Imran Ali', 'Designer', 85000, '0300-2145567'],
    ['Sana Tariq', 'Designer', 60000, '0321-4478120'],
    ['Tariq Javed', 'Supervisor', 70000, '0333-2219034'],
    ['Ahmed Khan', 'Operator', 42000, '0345-2093311'],
    ['Ali Raza', 'Operator', 40000, '0312-2675540'],
    ['Naveed Akhtar', 'Operator', 40000, '0301-7720145'],
    ['Shahid Iqbal', 'Operator', 38000, '0300-9081123'],
    ['Waqas Hussain', 'Operator', 38000, '0322-1180942'],
    ['Bilal Saeed', 'Operator', 36000, '0331-5567012'],
    ['Yasir Abbas', 'Helper', 28000, '0346-2290771'],
    ['Rukhsana Bibi', 'Finisher', 26000, '0302-3341908'],
    ['Arshad Mehmood', 'Store Keeper', 40000, '0315-8820443'],
  ];
  const employees: Employee[] = empRows.map(([name, designation, salary, phone], i) => ({ id: `e${i + 1}`, name, designation, salary, phone, active: true }));
  const operators = ['e4', 'e5', 'e6', 'e7', 'e8', 'e9'];

  // ---------- Machines ----------
  const machines: Machine[] = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `m${n}`, name: `Machine ${n}` }));

  // ---------- Customers ----------
  const custRows: [string, string, string][] = [
    ['Noor Bridal Studio', '0300-4412290', 'Lahore'],
    ["Ayesha's Boutique", '0321-2290114', 'Karachi'],
    ['Zainab Couture', '0333-3109876', 'Karachi'],
    ['Mrs. Saima Khan', '0345-2201983', 'Karachi'],
    ['Shehzadi Collection', '0300-3015542', 'Hyderabad'],
    ['Al-Madina Cloth House', '0312-6612098', 'Faisalabad'],
    ['Hania Designs', '0321-2785501', 'Karachi'],
    ['Mehwish Ladies Wear', '0332-2450918', 'Karachi'],
    ['Sitara Wedding Wear', '0301-4098812', 'Lahore'],
    ['Laila Pret', '0333-5190024', 'Islamabad'],
  ];
  const customers: Customer[] = custRows.map(([name, phone, city], i) => ({ id: `c${i + 1}`, name, phone, city }));

  // ---------- Orders ----------
  // [customer#, design, garment, qty, rate, dayOffset, deliveryAfter, status, notes]
  const orderRows: [number, string, string, number, number, number, number, OrderStatus, string?][] = [
    [1, '101', 'Lehenga', 4, 28000, -50, 25, 'Delivered', 'Bridal, red net, gold zari + sequins'],
    [2, '103', 'Kameez', 120, 650, -46, 14, 'Delivered', 'Front + sleeves, 3 colours'],
    [3, '104', 'Sharara', 12, 4200, -43, 18, 'Delivered'],
    [6, '109', 'Dupatta', 200, 450, -40, 12, 'Delivered', 'Border only'],
    [8, '110', 'Kameez', 150, 580, -36, 14, 'Delivered', 'Front'],
    [7, '115', 'Frock', 30, 2800, -30, 32, 'Completed'],
    [5, '116', 'Sharara', 20, 3900, -27, 30, 'Completed'],
    [2, '118', 'Kameez', 250, 520, -25, 30, 'Completed', 'Front'],
    [1, '120', 'Lehenga', 6, 32000, -22, 30, 'In Production', 'Bridal set on maroon net. Gold sequins.'],
    [3, '122', 'Gharara', 15, 5200, -20, 20, 'In Production', 'Copy of customer’s old garment'],
    [6, '123', 'Dupatta', 300, 420, -18, 21, 'In Production'],
    [10, '125', 'Kurti', 120, 680, -16, 22, 'In Production'],
    [8, '126', 'Frock', 45, 2200, -14, 22, 'In Production'],
    [9, '130', 'Kameez', 180, 600, -9, 18, 'Designing', 'Instagram screenshot'],
    [7, '131', 'Maxi / Gown', 10, 12500, -7, 25, 'Designing'],
    [1, '132', 'Lehenga', 3, 42000, -5, 35, 'Designing', 'Customer sent 3 TikTok screenshots'],
    [4, '133', 'Kameez', 4, 3500, -4, 14, 'Designing', 'WhatsApp picture'],
    [10, '135', 'Kameez', 200, 550, -2, 20, 'Pending'],
    [3, '136', 'Sari', 5, 9000, -1, 25, 'Pending', 'Border only'],
    [6, '137', 'Kameez', 400, 380, 0, 25, 'Pending', 'Rate to be confirmed after sample'],
    [9, '105', 'Kameez', 300, 600, -48, 15, 'Delivered', 'Front + daman'],
    [5, '107', 'Sharara', 25, 4500, -45, 20, 'Delivered'],
    [2, '111', 'Kurti', 200, 700, -38, 14, 'Delivered'],
    [4, '112', 'Lehenga', 2, 45000, -33, 20, 'Delivered', 'Walima, ivory with silver zari'],
    [6, '114', 'Dupatta', 400, 420, -31, 15, 'Delivered'],
    [8, '128', 'Frock', 60, 2400, -12, 20, 'In Production'],
  ];
  // order numbers follow the date
  orderRows.sort((a, b) => a[5] - b[5]);
  const orders: Order[] = orderRows.map(([ci, dn, garment, qty, rate, off, deliv, status, notes], i) => {
    const total = qty * rate;
    const advance = status === 'Pending' && i % 2 === 1 ? 0 : round(total * between(0.3, 0.5), 500);
    return {
      id: `o${i + 1}`,
      orderNo: String(1001 + i),
      customerId: `c${ci}`,
      date: D(off),
      designNo: dn,
      garment,
      referenceImage: i % 3 !== 2 ? motifSVG(i) : undefined,
      quantity: qty,
      rate,
      advance,
      deliveryDate: D(off + deliv),
      status,
      notes,
    };
  });

  // ---------- Payments received later ----------
  const payments: Payment[] = [];
  orders.forEach((o, i) => {
    const total = o.quantity * o.rate;
    if (o.status === 'Delivered') {
      const share = i === 1 || i === 4 ? 0.8 : 1; // two still have some balance
      const rest = share === 1 ? total - o.advance : round(total * share - o.advance, 500);
      if (rest > 0) payments.push({ id: id('p'), customerId: o.customerId, orderId: o.id, date: addDays(o.deliveryDate, 1), amount: rest, note: 'At delivery' });
    }
    if (o.status === 'Completed' && i % 2 === 0) payments.push({ id: id('p'), customerId: o.customerId, orderId: o.id, date: D(-3), amount: round(total * 0.25, 500) });
  });

  // ---------- Production ----------
  const production: ProductionEntry[] = [];
  const perDayFor = (qty: number, rate: number) => (rate >= 12000 ? 1 : qty >= 100 ? round(between(35, 60), 5) : round(between(5, 10), 1));
  // running orders by design → machine
  const active: Record<string, string> = { '120': 'm1', '122': 'm2', '123': 'm3', '125': 'm4', '126': 'm5', '128': 'm6' };
  for (const o of orders) {
    if (!['In Production', 'Completed', 'Delivered'].includes(o.status)) continue;
    const isActive = o.status === 'In Production';
    const machineId = isActive ? active[o.designNo] : `m${1 + Math.floor(r() * 6)}`;
    const operatorId = operators[Number(machineId.slice(1)) - 1];
    const goal = isActive ? Math.floor(o.quantity * between(0.45, 0.75)) : o.quantity;
    let made = 0;
    const days: string[] = [];
    for (let d = addDays(o.date, 6); d <= T; d = addDays(d, 1)) if (!isSunday(d)) days.push(d);
    const add = (date: string, q: number) => {
      production.push({ id: id('pr'), date, machineId, orderId: o.id, designNo: o.designNo, operatorId, quantity: q });
      made += q;
    };
    if (isActive) {
      // running orders: spread evenly up to today
      const perDay = Math.max(1, Math.round(goal / days.length));
      const every = perDay === 1 ? Math.max(1, Math.floor(days.length / goal)) : 1;
      days.forEach((d, k) => {
        if (made >= o.quantity || (days.length - 1 - k) % every !== 0) return;
        add(d, Math.min(o.quantity - made, Math.max(1, Math.round(perDay * between(0.8, 1.2)))));
      });
    } else {
      for (const d of days) {
        if (made >= goal) break;
        add(d, Math.min(goal - made, perDayFor(o.quantity, o.rate)));
      }
    }
  }

  // ---------- Inventory ----------
  // [category, item, type, code, unit, current qty, rate, low-stock level]
  const itemRows: [string, string, string, string, string, number, number, number][] = [
    ['SEQ', 'Sequin', 'Plane', '301', '', 720, 68, 200],
    ['SEQ', 'Sequin', 'Cup', '357', '', 500, 70, 150],
    ['SEQ', 'Sequin', 'Plane', '304', '', 380, 68, 150],
    ['SEQ', 'Sequin', 'Cup', '360', '', 260, 72, 100],
    ['SEQ', 'Sequin', 'Fancy', '410', '', 150, 95, 200], // low
    ['ZARI', 'Zari', 'Gold', 'Z-01', 'Cone', 85, 650, 30],
    ['ZARI', 'Zari', 'Silver', 'Z-02', 'Cone', 60, 650, 25],
    ['ZARI', 'Zari', 'Antique', 'Z-03', 'Cone', 40, 720, 15],
    ['ZARI', 'Zari', 'Copper', 'Z-04', 'Cone', 25, 700, 30], // low
    ['THREAD', 'Thread', 'Red', 'T-101', 'Cone', 40, 380, 15],
    ['THREAD', 'Thread', 'Maroon', 'T-102', 'Cone', 32, 380, 15],
    ['THREAD', 'Thread', 'Black', 'T-103', 'Cone', 45, 360, 15],
    ['THREAD', 'Thread', 'White', 'T-104', 'Cone', 50, 360, 20],
    ['THREAD', 'Thread', 'Ivory', 'T-105', 'Cone', 12, 380, 15], // low
    ['THREAD', 'Bobbin Thread', 'White', 'T-201', 'Cone', 60, 220, 25],
    ['FABRIC', 'Net', 'Soft', 'F-01', 'Meter', 220, 260, 100],
    ['FABRIC', 'Chiffon', 'Plain', 'F-02', 'Meter', 150, 340, 60],
    ['FABRIC', 'Organza', 'Plain', 'F-03', 'Meter', 45, 420, 60], // low
    ['FABRIC', 'Backing Paper', 'Tear-away', 'F-10', 'Meter', 400, 45, 150],
    ['PARTS', 'Needle', 'DBxK5 #11', 'P-01', 'Packet', 30, 650, 10],
    ['PARTS', 'Needle', 'DBxK5 #9', 'P-02', 'Packet', 6, 650, 10], // low
    ['PARTS', 'Bobbin', 'Standard', 'P-10', 'Piece', 200, 35, 50],
    ['PARTS', 'Bobbin Case', 'Standard', 'P-11', 'Piece', 24, 850, 6],
    ['PARTS', 'Rotary Hook', 'Standard', 'P-20', 'Piece', 6, 6500, 2],
    ['PARTS', 'Trimmer Knife', 'Set', 'P-21', 'Piece', 5, 4200, 2],
  ];
  const target = new Map<string, number>();
  const items: InventoryItem[] = itemRows.map(([category, name, type, code, unit, qty, rate, minQty], i) => {
    target.set(`i${i + 1}`, qty);
    return { id: `i${i + 1}`, category, name, type, code, unit: unit || undefined, openingQty: 0, rate, minQty };
  });

  // ---------- Suppliers & purchases ----------
  const suppliers: Supplier[] = [
    { id: 's1', name: 'Madina Thread House', phone: '0300-2145500', city: 'Karachi' },
    { id: 's2', name: 'Lahore Zari Centre', phone: '0321-4478100', city: 'Lahore' },
    { id: 's3', name: 'Al-Karim Sequins', phone: '0333-2219000', city: 'Karachi' },
    { id: 's4', name: 'Hassan Fabrics', phone: '0345-2093300', city: 'Karachi' },
    { id: 's5', name: 'Embro Tech Spares', phone: '0312-2675500', city: 'Karachi' },
  ];
  // [supplier, item, dayOffset, share of current stock bought, paid share]
  const purchaseRows: [string, string, number, number, number][] = [
    ['s3', 'i1', -40, 0.5, 1],
    ['s3', 'i2', -40, 0.5, 1],
    ['s1', 'i10', -35, 0.6, 1],
    ['s1', 'i12', -35, 0.5, 1],
    ['s4', 'i16', -30, 0.5, 1],
    ['s2', 'i6', -26, 0.5, 0.5],
    ['s5', 'i20', -21, 0.6, 1],
    ['s3', 'i3', -15, 0.6, 0.5],
    ['s4', 'i19', -12, 0.5, 0],
    ['s1', 'i13', -8, 0.5, 0],
    ['s2', 'i7', -5, 0.5, 0],
    ['s3', 'i1', -2, 0.3, 0],
  ];
  const purchases: Purchase[] = [];
  const stock: StockEntry[] = [];
  const supName = new Map(suppliers.map((s) => [s.id, s.name]));
  purchaseRows.forEach(([supplierId, itemId, off, share, paidShare], i) => {
    const it = items.find((x) => x.id === itemId)!;
    const qty = round(target.get(itemId)! * share, 5);
    const amount = qty * it.rate;
    const p: Purchase = { id: `pu${i + 1}`, date: D(off), supplierId, itemId, qty, rate: it.rate, paid: round(amount * paidShare, 100), billNo: String(4100 + i * 7) };
    purchases.push(p);
    stock.push({ id: id('st'), itemId, date: p.date, type: 'IN', qty, note: `Purchase from ${supName.get(supplierId)}`, purchaseId: p.id });
  });
  const supplierPayments: SupplierPayment[] = [{ id: id('sp'), supplierId: 's2', date: D(-10), amount: 10000, note: 'Cash' }];

  // Material issued to production (OUT)
  const outRows: [string, number, number, string][] = [
    ['i1', -30, 0.2, 'Machine 1 — Design 120'],
    ['i2', -24, 0.15, 'Machine 2 — Design 122'],
    ['i6', -20, 0.2, 'Design 120'],
    ['i10', -18, 0.25, 'Design 123'],
    ['i12', -14, 0.2, 'Design 125'],
    ['i16', -12, 0.3, 'Design 120 / 122'],
    ['i19', -9, 0.25, 'All machines'],
    ['i20', -7, 0.2, 'All machines'],
    ['i1', -4, 0.1, 'Machine 1 — Design 120'],
    ['i3', -3, 0.15, 'Machine 5 — Design 126'],
    ['i13', -2, 0.2, 'Design 125'],
    ['i24', -6, 0.17, 'Machine 4 repair'],
    ['i5', -8, 0.5, 'Machine 1 — Design 120'],
    ['i9', -5, 0.6, 'Design 122'],
    ['i14', -6, 1, 'Design 131 sample'],
    ['i18', -10, 0.8, 'Design 126'],
    ['i21', -3, 1.5, 'All machines'],
  ];
  for (const [itemId, off, share, note] of outRows) {
    stock.push({ id: id('st'), itemId, date: D(off), type: 'OUT', qty: Math.max(1, round(target.get(itemId)! * share, 1)), note: `Issued: ${note}` });
  }
  // Opening stock = whatever makes the current balance equal the target figure
  for (const it of items) {
    const net = stock.filter((s) => s.itemId === it.id).reduce((a, s) => a + (s.type === 'IN' ? s.qty : -s.qty), 0);
    it.openingQty = target.get(it.id)! - net;
  }

  // ---------- Expenses ----------
  const expRows: [number, string, string, number][] = [
    [-48, 'Factory rent', 'Rent', 180000],
    [-18, 'Factory rent', 'Rent', 180000],
    [-40, 'Electricity bill', 'Electricity', 142500],
    [-10, 'Electricity bill', 'Electricity', 156800],
    [-33, 'Generator diesel', 'Diesel / Generator', 28500],
    [-6, 'Generator diesel', 'Diesel / Generator', 29500],
    [-28, 'Machine 3 service', 'Machine Repair', 18000],
    [-6, 'Machine 4 rotary hook fitting', 'Machine Repair', 12500],
    [-38, 'Courier to Lahore', 'Transport', 4500],
    [-14, 'Loader rickshaw — deliveries', 'Transport', 2800],
    [-2, 'Loader rickshaw — fabric pickup', 'Transport', 2200],
    [-44, 'Staff tea & lunch', 'Tea / Food', 9500],
    [-30, 'Staff tea & lunch', 'Tea / Food', 10200],
    [-16, 'Staff tea & lunch', 'Tea / Food', 9900],
    [-1, 'Staff tea & lunch', 'Tea / Food', 10400],
    [-9, 'Stationery & registers', 'Other', 3200],
  ];
  const expenses: Expense[] = expRows.map(([off, title, category, amount]) => ({ id: id('x'), date: D(off), title, category, amount }));

  // ---------- Salaries (last month, paid) ----------
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  const salaries: SalaryRecord[] = employees.map((e, i) => ({
    id: id('sal'),
    employeeId: e.id,
    month: lastMonth,
    salary: e.salary,
    bonus: e.designation === 'Operator' && i % 2 === 0 ? 3000 : 0,
    advance: i === 4 || i === 9 ? 5000 : 0,
    deduction: i === 7 ? 1500 : 0,
    paid: true,
    note: e.designation === 'Operator' && i % 2 === 0 ? 'Production bonus' : i === 7 ? '1 day absent' : undefined,
  }));

  return {
    settings: { factoryName: 'Gulshan Embroidery Works' },
    customers,
    orders,
    payments,
    machines,
    production,
    items,
    stock,
    suppliers,
    purchases,
    supplierPayments,
    employees,
    salaries,
    expenses,
  };
}
