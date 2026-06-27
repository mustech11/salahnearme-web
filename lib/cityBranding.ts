export type CityBranding = {
  tagline: string;
  symbol: string;
  image?: string;
};

export const cityBranding: Record<string, CityBranding> = {
  manchester: {
    tagline: "Mosques, halal businesses, and community life across Manchester.",
    symbol: "Manchester Bee",
    image: "/cities/manchester.png",
  },
  london: {
    tagline: "Explore mosques and halal life across London.",
    symbol: "London Skyline",
    image: "/cities/london.png",
  },
  birmingham: {
    tagline: "Discover mosques and halal businesses across Birmingham.",
    symbol: "Birmingham Skyline",
    image: "/cities/birmingham.png",
  },
  leicester: {
    tagline: "Find mosques and halal services across Leicester.",
    symbol: "Leicester Landmark",
    image: "/cities/leicester.png",
  },
  bradford: {
    tagline: "Browse mosques and halal businesses in Bradford.",
    symbol: "Bradford Landmark",
    image: "/cities/bradford.png",
  },
  luton: {
    tagline: "Explore mosques and halal businesses in Luton.",
    symbol: "Luton Landmark",
    image: "/cities/luton.png",
  },
  blackburn: {
    tagline: "Find mosques and halal services in Blackburn.",
    symbol: "Blackburn Landmark",
    image: "/cities/blackburn.png",
  },
  newham: {
    tagline: "Explore mosques and halal life across Newham.",
    symbol: "Newham Landmark",
    image: "/cities/newham.png",
  },
  redbridge: {
    tagline: "Discover mosques and halal businesses across Redbridge.",
    symbol: "Redbridge Landmark",
    image: "/cities/redbridge.png",
  },
  rochdale: {
    tagline: "Find mosques and halal services in Rochdale.",
    symbol: "Rochdale Landmark",
    image: "/cities/rochdale.png",
  },
  nottingham: {
    tagline: "Explore mosques and halal businesses in Nottingham.",
    symbol: "Nottingham Landmark",
    image: "/cities/nottingham.png",
  },
  coventry: {
    tagline: "Discover mosques and halal community listings in Coventry.",
    symbol: "Coventry Landmark",
    image: "/cities/coventry.png",
  },
  wolverhampton: {
    tagline: "Find mosques and halal businesses in Wolverhampton.",
    symbol: "Wolverhampton Landmark",
    image: "/cities/wolverhampton.png",
  },
};

