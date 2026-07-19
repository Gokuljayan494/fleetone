export type Status = "emr" | "sky" | "org" | "red" | "ind" | "slate";

export const vehicles = [
  { model: "Tata Ace Gold", plate: "KA 05 MJ 2211", status: "On trip", tone: "emr" as Status, driver: "Suresh Kumar", av: "g1", health: 94, lastService: "12 Jun", km: "82,410", kmpl: 13.2, stroke: "#4F46E5", tint: "linear-gradient(135deg,#EEF0FE,#E4ECFB)", kind: "van" },
  { model: "Ashok Leyland Dost+", plate: "TN 09 BQ 4432", status: "In transit", tone: "sky" as Status, driver: "Ravi Venkat", av: "g3", health: 88, lastService: "28 May", km: "1,04,880", kmpl: 11.8, stroke: "#0369A1", tint: "linear-gradient(135deg,#E6F5FD,#E3EEFA)", kind: "truck" },
  { model: "Mahindra Bolero Pikup", plate: "KA 03 HT 8874", status: "Service due", tone: "org" as Status, driver: "Prakash D", av: "g4", health: 61, lastService: "02 Mar", km: "1,46,200", kmpl: 9.4, stroke: "#C2410C", tint: "linear-gradient(135deg,#FEF0E6,#FBEAE0)", kind: "van" },
  { model: "Eicher Pro 2049", plate: "KA 01 AB 9034", status: "On trip", tone: "emr" as Status, driver: "Mohammed Faiz", av: "g2", health: 91, lastService: "30 Jun", km: "58,340", kmpl: 10.6, stroke: "#067A57", tint: "linear-gradient(135deg,#E7F8F1,#E2F1EC)", kind: "truck" },
  { model: "Maruti Super Carry", plate: "KA 51 EC 1120", status: "On trip", tone: "emr" as Status, driver: "Anita Nair", av: "g5", health: 86, lastService: "19 Jun", km: "41,975", kmpl: 14.1, stroke: "#7C3AED", tint: "linear-gradient(135deg,#EEF0FE,#F0EAFB)", kind: "van" },
  { model: "Tata 407 Gold SFC", plate: "AP 16 TC 5567", status: "Insurance expiring", tone: "red" as Status, driver: "Vijay Raj", av: "g6", health: 74, lastService: "08 Jul", km: "93,120", kmpl: 8.9, stroke: "#B91C1C", tint: "linear-gradient(135deg,#FDEBEB,#F9E7EF)", kind: "truck" },
];

export const drivers = [
  { name: "Suresh Kumar", initials: "SK", av: "g1", rating: 4.9, starsOn: 5, score: 90 + 4, vehicle: "KA 05 MJ 2211", license: { label: "License valid", tone: "emr" as Status }, trips: 64, attendance: 98, onTime: 96 },
  { name: "Ravi Venkat", initials: "RV", av: "g3", rating: 4.6, starsOn: 4, score: 88, vehicle: "TN 09 BQ 4432", license: { label: "License valid", tone: "emr" as Status }, trips: 57, attendance: 95, onTime: 93 },
  { name: "Prakash D", initials: "PD", av: "g4", rating: 3.8, starsOn: 3, score: 71, vehicle: "KA 03 HT 8874", license: { label: "License expires 24 Jul", tone: "red" as Status }, trips: 41, attendance: 88, onTime: 81 },
  { name: "Mohammed Faiz", initials: "MF", av: "g2", rating: 4.8, starsOn: 5, score: 91, vehicle: "KA 01 AB 9034", license: { label: "License valid", tone: "emr" as Status }, trips: 59, attendance: 97, onTime: 95 },
  { name: "Anita Nair", initials: "AN", av: "g5", rating: 4.9, starsOn: 5, score: 95, vehicle: "KA 51 EC 1120", license: { label: "License valid", tone: "emr" as Status }, trips: 62, attendance: 99, onTime: 97 },
  { name: "Vijay Raj", initials: "VJ", av: "g6", rating: 4.2, starsOn: 4, score: 82, vehicle: "AP 16 TC 5567", license: { label: "License expires Sep", tone: "org" as Status }, trips: 48, attendance: 92, onTime: 89 },
];

export const trips = [
  { plate: "KA 05 MJ 2211", vkind: "van", vtone: "ind", driver: "Suresh Kumar", av: "g1", ini: "SK", customer: "Zenith Logistics", km: "312 km", dur: "6h 40m", rev: "₹18,400", status: "Completed", tone: "emr" as Status },
  { plate: "TN 09 BQ 4432", vkind: "truck", vtone: "sky", driver: "Ravi Venkat", av: "g3", ini: "RV", customer: "Sunrise Foods", km: "148 km", dur: "3h 05m", rev: "₹9,150", status: "In transit", tone: "sky" as Status },
  { plate: "KA 01 AB 9034", vkind: "van", vtone: "emr", driver: "Mohammed Faiz", av: "g2", ini: "MF", customer: "Nova Pharma", km: "86 km", dur: "2h 10m", rev: "₹5,600", status: "In transit", tone: "sky" as Status },
  { plate: "KA 03 HT 8874", vkind: "truck", vtone: "org", driver: "Prakash D", av: "g4", ini: "PD", customer: "Metro Cash & Carry", km: "54 km", dur: "1h 25m", rev: "₹3,900", status: "Delayed", tone: "org" as Status },
  { plate: "KA 51 EC 1120", vkind: "van", vtone: "ind", driver: "Anita Nair", av: "g5", ini: "AN", customer: "GreenKart Grocery", km: "122 km", dur: "2h 50m", rev: "₹7,250", status: "Completed", tone: "emr" as Status },
  { plate: "AP 16 TC 5567", vkind: "truck", vtone: "red", driver: "Vijay Raj", av: "g6", ini: "VJ", customer: "Coastal Exports", km: "428 km", dur: "9h 15m", rev: "₹24,800", status: "Route deviation", tone: "red" as Status },
];

export const notifications = [
  { icon: "warn", tone: "red" as Status, title: "Route deviation · AP 16 TC 5567", body: "8.4 km off planned route near Nellore.", when: "2m", unread: true },
  { icon: "fuel", tone: "org" as Status, title: "Possible fuel drop · HT 8874", body: "Level fell 9% while parked at Hosur.", when: "18m", unread: true },
  { icon: "wrench", tone: "sky" as Status, title: "Service reminder", body: "Brake pads · HT 8874 · booked Sat 9 am.", when: "1h", unread: true },
  { icon: "shield", tone: "org" as Status, title: "Insurance expiring", body: "TC 5567 · policy ends in 6 days.", when: "3h", unread: false },
  { icon: "check", tone: "emr" as Status, title: "Trip completed · KA 51 EC 1120", body: "Mysuru run · ₹7,250 collected.", when: "4h", unread: false },
  { icon: "doc", tone: "ind" as Status, title: "Permit renewed", body: "National permit · BQ 4432 · valid to 2027.", when: "6h", unread: false },
];

export const revenueSeries = {
  months: ["Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  revenue: [6.4, 7.4, 9.5, 10.8, 13.1, 12.4],
  expenses: [2.9, 3.3, 3.9, 3.75, 4.8, 4.5],
};

export const fuelEfficiency = [
  { plate: "EC 1120", kmpl: 14.1 },
  { plate: "MJ 2211", kmpl: 13.2 },
  { plate: "BQ 4432", kmpl: 11.8 },
  { plate: "AB 9034", kmpl: 10.6 },
  { plate: "HT 8874", kmpl: 9.4 },
  { plate: "TC 5567", kmpl: 8.9 },
];
export const fleetAvgKmpl = 11.5;
