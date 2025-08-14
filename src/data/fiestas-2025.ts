// src/data/fiestas-2025.ts
export type Turno = 'mañana' | 'tarde' | 'noche';
export interface Actividad {
    id?: string;           // ID opcional para identificar la actividad
    time: string;          // "09:00"
    title: string;        // "Paseo guiado..."
    description?: string;  // "Un paseo guiado por el hermoso monte de Morón."
    shortTitle?: string;   // "Paseo guiado"
    location?: string;        // "Plaza" | "Bar-Plaza" | "Río" | "Monte de Morón"
    responsible?: string;  // "José Luis" | "Gaspar" | "Rafa" | ...
    price?: string;       // "1€" | "5€" | "13€"
    notes?: string;        // tickets, bingo, etc.
    icon?: string;        // si usas pictos
}

export interface DiaFiestas {
  ISODate: string;                   // "2025-08-15"
  weekDay: string;                  // "Jueves"
  activities: Record<Turno, Actividad[]>;
}

// Fechas estimadas: Jueves 15 → Domingo 18 de agosto de 2025
export const FIESTAS_2025: DiaFiestas[] = [
  {
    ISODate: "2025-08-15",
    weekDay: "Jueves",
    activities: {
      mañana: [
        {
          id: "actividad-1",
          time: "09:00",
          title: "Paseo guiado por el monte de Morón",
          shortTitle: "Paseo guiado",
          location: "Monte de Morón",
          price: "5€",
          responsible: "José Luis",
          notes: "Llevar calzado adecuado, agua, gorra y protector solar. Bocadillo opcional.",
        },
      ],
      tarde: [
        {
          time: "20:00",
          title: "Pregón",
          shortTitle: "Pregón",
          location: "Plaza",
          responsible: "Gaspar",
          notes: "Pendiente de que Gaspar confirme disponibilidad",
        },
        {
          time: "20:30",
          title: "Pincho de La Puebla",
          shortTitle: "Ecapincho",
          location: "Bar-Plaza",
          price: "1€",
          notes: "Abrir colaboración para más pinchos",
        },
      ],
      noche: [
        {
          time: "22:30",
          title: "Cine a la fresca",
          shortTitle: "Cine",
          responsible: "Rafa",
          location: "Plaza",
          price: "5€",
          notes: "Elegir película",
        },
      ],
    },
  },
  {
    ISODate: "2025-08-16",
    weekDay: "Viernes",
    activities: {
      mañana: [
        { time: "10:00",
          title: "Sesión de Yoga",
          shortTitle: "Yoga",
          responsible: "Tere",
          location: "Plaza",
          price: "5€",
        },
        { time: "12:00",
          title: "Taller de pulseras",
          shortTitle: "Pulseras",
          responsible: "Tere + 1",
          location: "Plaza",
          price: "5€",
        },
      ],
      tarde: [
        {
          time: "18:00",
          title: "Campeonato de mus y rabino",
          notes: "Isabel encarga trofeo del mus",
        },
        { time: "18:30", title: "Gincana" },
        {
          time: "20:00",
          title: "Orquesta (1ª sesión)",
          notes: "20:00–21:30; horario ajustable",
        },
      ],
      noche: [
        {
          time: "21:30",
          title: "Cena en la plaza (carrilleras)",
          price: "13€",
          notes:
            "Comprar pan (1 barra/3), bandejas de queso (1/4), lacitos (Esther). Agua y vino del bar (Miguel controla).",
        },
        {
          time: "00:30",
          title: "Orquesta (2ª sesión)",
          notes: "00:30–04:00; bingo en el descanso",
        },
      ],
    },
  },
  {
    ISODate: "2025-08-17",
    weekDay: "Sábado",
    activities: {
      mañana: [
        {
          time: "12:00",
          title: "Misa con música",
          notes: "Después, subasta de trenzas (comprar 8)",
        },
        {
          time: "13:00",
          title: "Vermut con música y gildas",
          notes: "Comprar gildas (definir unidades)",
        },
      ],
      tarde: [
        {
          time: "17:30",
          title: "Campeonatos de guiñote, futbolín y ping pong",
        },
        { time: "19:00", title: "Juegos populares en la plaza" },
        {
          time: "20:00",
          title:
            "Mercadillo de artesanía / merchandising Puebla de Eca (imanes)",
          notes:
            "Hablar con hijas de Benita. Imanes de Virginie (5€ unidad).",
        },
        { time: "20:30", title: "DJ (1ª sesión)", notes: "20:30–22:00" },
      ],
      noche: [
        {
          time: "22:00",
          title: "Ración de migas",
          shortTitle: "Migas",
          responsible: "Esther",
          location: "Plaza",
          price: "5€",
          notes:
            "Venta con tickets (comprar talonario); decidir punto de venta.",
        },
        { time: "23:30",
          title: "Bingo",
          shortTitle: "Bingo",
          location: "Plaza",
          price: "2€ y 5€",
          responsible: "Juli & Jose",
          notes: "Importante: llevar efectivo para los cartones",
         },
        { time: "00:00", title: "DJ (2ª sesión)", notes: "La sesión de DJ dura hasta las 04:00" },
      ],
    },
  },
  {
    ISODate: "2025-08-18",
    weekDay: "Domingo",
    activities: {
      mañana: [
        {
          time: "14:00",
          title: "Comida popular (paella)",
          location: "Río",
          price: "13€",
          notes:
            "Contratada la paella y el flan (sin embutido/ensalada). Los encurtidos y embutido (tamaño bandejas) se sirven aparte, pan (1 barra/3). Bajar bebidas (cerveza, vino, refrescos); valorar barreños/hielo.",
        },
      ],
      tarde: [
        {
          time: "16:30",
          title: "Campeonato de bolos, música y copeo",
          notes: "Tradicional juego de bolos artesanales, con bolas meta-esféricas, el no va más de la habilidad",
        },
      ],
      noche: [
        {
          time: "21:00",
          title: "Tortillas y postres",
          notes:
            "Para la merienda: 20 barras, 4 kg jamón, 1 botella AOVE (~1/4), 8 kg tomate, refrescos (ajustar a la baja), servilletas/vasos/palillos. Valorar tortillas Mercadona → ajustar pan/jamón/tomate. Sangría: 15 L vino tinto, 6×1.5 L Trina naranja, 4×1.5 L Trina limón, 8 kg melocotón, 1 kg azúcar; preparar hielo en botellas 1.5 L.",
        },
        { time: "22:00",
          title: "Entrega de trofeos y bingo",
          notes: "Último bingo de las fiestas y colofón con entrega de premios y trofeos.",
        },
      ],
    },
  },
];

// Aportaciones (para tu KB/FAQ)
export const APORTACIONES = {
  regla: "Mis mismas aportaciones que el año pasado",
  detalle:
    "Menores de 4 sin aportación; 4–12 años: 5€; mayores de 13: 10€.",
};