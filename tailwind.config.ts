import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	screens: {
  		xs: '500px',
  		sm: '640px',
  		md: '768px',
  		lg: '1024px',
  		xl: '1280px',
  		'2xl': '1536px',
  		'3xl': '2000px'
  	},
  	extend: {
  		fontFamily: {
  			geist:["var(--font-geist-sans)"],
  			mono:["var(--font-geist-mono)"]
  		},
       backgroundImage: {
        gradientBlue: 'linear-gradient(to bottom, #000510 40%, #031438)',
      },
      colors:{
         redColor:'#e1002d'
      }
  	}
  },
  darkMode:"class",
  plugins: [],
};
export default config;
