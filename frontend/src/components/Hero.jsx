/**
 * Hero Section - Landing page introduction
 *
 * Displays the MoodNest branding and explains what the app does.
 * This is the first thing users see before they interact with the 3D apartment.
 */
export default function Hero() {
  return (
    <div className="text-white space-y-6">
      {/* App title with gradient effect */}
      <h1
        className="text-8xl font-bold bg-gradient-to-br from-purple-400 to-pink-400 bg-clip-text text-transparent title-hover"
        style={{ fontFamily: "Space Grotesk, sans-serif" }}
      >
        MoodNest
      </h1>

      {/* Tagline */}
      <p
        className="text-3xl text-white animate-fadeInUp delay-100 opacity-0 title-hover"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        Your home that feels what you feel
      </p>

      {/* Description of what the app does */}
      <p
        className="text-2xl text-white leading-relaxed animate-fadeInUp delay-200 opacity-0 title-hover"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        Speak your mind, and watch your home respond. MoodNest listens to your
        voice and adapts lighting, ambience, and music to match your mood in
        real time.
      </p>
    </div>
  );
}
