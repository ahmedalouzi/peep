import { DesignManifest } from './design-types';

export class DesignReasoner {
  static inferDesignDNA(productDescription: string): DesignManifest {
    const descLower = productDescription.toLowerCase();
    
    let brandPersonality = "professional, modern, friendly";
    let visualDirection = "clean mobile layout with vibrant warm tones";
    let primary = "#e11d48"; // Rose
    let secondary = "#fb7185";
    let accent = "#f59e0b"; // Amber
    let background = "#ffffff";
    let surface = "#f8fafc";
    let onPrimary = "#ffffff";
    let onBackground = "#0f172a";

    if (descLower.includes('luxury') || descLower.includes('premium')) {
      brandPersonality = "elegant, premium, refined";
      visualDirection = "high-end luxury dark mode with gold/bronze accents";
      primary = "#d97706"; // Amber/Gold
      secondary = "#78350f";
      accent = "#f59e0b";
      background = "#09090b";
      surface = "#18181b";
      onBackground = "#fafafa";
    } else if (descLower.includes('restaurant') || descLower.includes('food') || descLower.includes('reservation')) {
      brandPersonality = "warm, inviting, culinary-focused";
      visualDirection = "inviting layout with warm terracotta and sage accents";
      primary = "#c2410c"; // Terracotta orange
      secondary = "#ea580c";
      accent = "#15803d"; // Sage green
      background = "#fffbeb";
      surface = "#ffffff";
      onBackground = "#431407";
    } else if (descLower.includes('finance') || descLower.includes('bank') || descLower.includes('money')) {
      brandPersonality = "secure, trusted, sophisticated";
      visualDirection = "corporate trust theme with deep emerald greens and clean geometry";
      primary = "#047857"; // Emerald Green
      secondary = "#059669";
      accent = "#3b82f6";
      background = "#f0fdfa";
      surface = "#ffffff";
      onBackground = "#064e3b";
    }

    return {
      brandPersonality,
      visualDirection,
      colors: {
        primary,
        secondary,
        accent,
        background,
        surface,
        onPrimary,
        onBackground,
        error: "#ef4444",
        success: "#22c55e",
        warning: "#eab308",
        neutral: {
          "50": "#f8fafc",
          "100": "#f1f5f9",
          "200": "#e2e8f0",
          "500": "#64748b",
          "900": "#0f172a"
        }
      },
      typography: {
        fontFamily: "System",
        headingStyle: "bold, tracking-tight",
        bodyStyle: "regular weight, line-height 1.5",
        codeFont: "Courier",
        scaleBase: 16
      },
      spacing: {
        unit: 4,
        scale: [4, 8, 12, 16, 24, 32, 48, 64]
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        full: 9999
      },
      elevation: {
        none: "none",
        sm: "0px 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0px 10px 15px rgba(0, 0, 0, 0.1)"
      },
      iconography: "Feather/Ionicons styled clean icons matching accent colors",
      buttons: {
        primary: "filled, rounded-md, center align",
        secondary: "outlined, rounded-md"
      },
      inputs: "outlined, light borders, clean placeholder labels",
      cards: "white background, light shadow elevation, medium border radius",
      navigation: "bottom tab bar controller with top back buttons",
      composition: "vertical scroll flows with consistent container margins",
      animations: "subtle spring scale on buttons, page slide transitions",
      loadingState: "ActivityIndicator placeholder overlay with loading label spinner",
      emptyState: "centered neutral icon, illustration title, primary call-to-action button",
      errorState: "inline red warning box, clean descriptions, reload option",
      successState: "checkmark splash animation, transaction record details",
      accessibilityRules: "minimum 44dp tap target size, contrast ratios above 4.5:1"
    };
  }
}
