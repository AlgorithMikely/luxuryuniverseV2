import React, { useEffect, useState } from "react";
import api from "../services/api";

interface AchievementData {
  artist_stats: {
    submissions: number;
    avg_score: number;
  };
  streamer_stats?: {
    likes: number;
    diamonds: number;
    viewers_peak: number;
  };
  fan_stats?: {
    likes_sent: number;
    gifts_sent: number;
    comments_sent: number;
    shares_sent: number;
  };
  badges: Array<{
    slug: string;
    name: string;
    description: string;
    unlocked: boolean;
    unlocked_at: string | null;
    role_status: string | null;
    reward_role_id: string | null;
    progress: number;
    current_value: number;
    threshold_value: number;
    category: string;
    role_color: string | null;
    role_icon: string | null;
    is_hidden: boolean;
  }>;
}

const AchievementsTab = () => {
  const [data, setData] = useState<AchievementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchAchievements = async () => {
    try {
      const response = await api.get<AchievementData>("/user/achievements");
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  // --- CATEGORY GROUPING LOGIC ---
  const ARTIST_CATEGORIES = [
    'SUBMISSION_COUNT', 'METADATA_TAG', 'LINK_TYPE', 'GENRE_COUNT',
    'WIN_STREAK', 'POLL_WIN_PERCENT', 'SCORE_SWING', 'REVIEW_SCORE'
  ];
  const STREAMER_CATEGORIES = [
    'LIFETIME_LIKES', 'CONCURRENT_VIEWERS', 'LIFETIME_DIAMONDS'
  ];
  // Fan includes everything else essentially, or specific lists
  const FAN_CATEGORIES = [
    'CHAT_RAINBOW', 'CHAT_ALL_CAPS', 'CHAT_EMOJI_ONLY', 'POLL_VOTES',
    'CHAT_KEYWORD_SPAM', 'LIFETIME_LIKES_SENT', 'LIFETIME_GIFTS_SENT',
    'LIFETIME_TIKTOK_COMMENTS', 'LIFETIME_TIKTOK_SHARES',
    'DISCORD_WELCOME', 'DISCORD_VOICE_MINS', 'DISCORD_MSG_COUNT',
    'DISCORD_SCREEN_SHARE_MINS', 'DISCORD_VC_GHOST', 'DISCORD_MSG_REPEAT',
    'BADGE', 'TOTAL_ACHIEVEMENTS'
  ];

  const getCategoryGroup = (category: string) => {
    if (ARTIST_CATEGORIES.includes(category)) return 'Artist';
    if (STREAMER_CATEGORIES.includes(category)) return 'Streamer';
    return 'Fan'; // Default to Fan/Community
  };

  const getProgress = (group: string) => {
    if (!data) return { unlocked: 0, total: 0, percentage: 0 };
    const visibleBadges = data.badges.filter(b =>
      getCategoryGroup(b.category) === group && (!b.is_hidden || b.unlocked)
    );

    const unlocked = visibleBadges.filter(b => b.unlocked).length;
    const total = visibleBadges.length;
    return {
      unlocked,
      total,
      percentage: total > 0 ? (unlocked / total) * 100 : 0
    };
  };

  const artistProgress = getProgress('Artist');
  const streamerProgress = getProgress('Streamer');
  const fanProgress = getProgress('Fan');

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null); // Deselect if already selected
    } else {
      setSelectedCategory(category);
    }
  };

  const filteredBadges = data?.badges.filter(badge => {
    if (selectedCategory) {
      return getCategoryGroup(badge.category) === selectedCategory;
    }
    // If no category selected, show all EXCEPT streamer if streamer stats are missing
    if (!data.streamer_stats && getCategoryGroup(badge.category) === 'Streamer') {
      return false;
    }
    return true;
  }) || [];

  if (isLoading) return <div className="text-gray-400 p-8 text-center">Loading Stats...</div>;
  if (!data) return <div className="text-gray-400 p-8 text-center">Failed to load stats.</div>;

  return (
    <div className="space-y-8">
      {/* Achievement Progress Headers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Artist Progress */}
        <div
          onClick={() => handleCategoryClick('Artist')}
          className={`bg-gradient-to-br from-purple-900/40 to-gray-900 rounded-xl p-4 border relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${selectedCategory === 'Artist' ? 'border-purple-400 ring-2 ring-purple-500/50' : 'border-purple-500/30'}`}
        >
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-purple-300 flex items-center gap-2">
                <span className="text-xl">🎨</span> Artist Journey
              </h3>
              <span className="text-2xl font-bold text-white">{artistProgress.unlocked}/{artistProgress.total}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${artistProgress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-purple-400 mt-2 text-right">{artistProgress.percentage.toFixed(0)}% Complete</p>
          </div>
        </div>

        {/* Fan Progress */}
        <div
          onClick={() => handleCategoryClick('Fan')}
          className={`bg-gradient-to-br from-pink-900/40 to-gray-900 rounded-xl p-4 border relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${selectedCategory === 'Fan' ? 'border-pink-400 ring-2 ring-pink-500/50' : 'border-pink-500/30'}`}
        >
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-pink-300 flex items-center gap-2">
                <span className="text-xl">🤝</span> Community
              </h3>
              <span className="text-2xl font-bold text-white">{fanProgress.unlocked}/{fanProgress.total}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${fanProgress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-pink-400 mt-2 text-right">{fanProgress.percentage.toFixed(0)}% Complete</p>
          </div>
        </div>

        {/* Streamer Progress - Only show if streamer stats exist */}
        {data.streamer_stats && (
          <div
            onClick={() => handleCategoryClick('Streamer')}
            className={`bg-gradient-to-br from-blue-900/40 to-gray-900 rounded-xl p-4 border relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${selectedCategory === 'Streamer' ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-blue-500/30'}`}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-blue-300 flex items-center gap-2">
                  <span className="text-xl">📡</span> Streamer
                </h3>
                <span className="text-2xl font-bold text-white">{streamerProgress.unlocked}/{streamerProgress.total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${streamerProgress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-blue-400 mt-2 text-right">{streamerProgress.percentage.toFixed(0)}% Complete</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
            Artist Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total Submissions</p>
              <p className="text-2xl font-bold">{data.artist_stats.submissions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Score</p>
              <p className="text-2xl font-bold">{data.artist_stats.avg_score.toFixed(1)}</p>
            </div>
          </div>
        </div>

        {data.streamer_stats ? (
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              Streamer Stats
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Lifetime Likes</p>
                <p className="text-2xl font-bold">{(data.streamer_stats.likes || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Diamonds</p>
                <p className="text-2xl font-bold">{(data.streamer_stats.diamonds || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Peak Viewers</p>
                <p className="text-2xl font-bold">{data.streamer_stats.viewers_peak}</p>
              </div>
            </div>
          </div>
        ) : data.fan_stats ? (
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-pink-400 mb-4 flex items-center gap-2">
              Fan Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Likes Sent</p>
                <p className="text-2xl font-bold">{(data.fan_stats.likes_sent || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Gifts Sent (Diamonds)</p>
                <p className="text-2xl font-bold">{(data.fan_stats.gifts_sent || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Comments</p>
                <p className="text-2xl font-bold">{(data.fan_stats.comments_sent || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Shares</p>
                <p className="text-2xl font-bold">{(data.fan_stats.shares_sent || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Badges Grid */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">
            {selectedCategory ? `${selectedCategory} Achievements` : 'Trophy Case'}
          </h3>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBadges.map((badge) => (
            <div
              key={badge.slug}
              className={`relative p-5 rounded-lg border transition-all overflow-hidden ${badge.unlocked
                ? "bg-gradient-to-br from-gray-800 to-gray-900 border-opacity-50 shadow-lg"
                : "bg-gray-900/50 border-gray-800 opacity-70"
                }`}
              style={{
                borderColor: badge.unlocked ? (badge.role_color || "#a855f7") : undefined,
                boxShadow: badge.unlocked ? `0 4px 20px -5px ${(badge.role_color || "#a855f7")}40` : undefined
              }}
            >
              {/* Background Glow for Unlocked */}
              {badge.unlocked && (
                <div
                  className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 pointer-events-none"
                  style={{ backgroundColor: badge.role_color || "#a855f7" }}
                />
              )}

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  {/* Icon Display */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border ${badge.unlocked
                      ? "bg-gray-800 text-white"
                      : "bg-gray-800/50 text-gray-600 border-gray-700"
                      }`}
                    style={{
                      borderColor: badge.unlocked ? (badge.role_color || "#a855f7") : undefined,
                      color: badge.unlocked ? (badge.role_color || "#a855f7") : undefined
                    }}
                  >
                    {badge.role_icon || "🏆"}
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg leading-tight ${badge.unlocked ? "text-white" : "text-gray-500"}`}>
                      {badge.name}
                    </h4>
                    <div className="mt-1">
                      {badge.unlocked ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/30 text-green-400 border border-green-800">
                          UNLOCKED
                        </span>
                      ) : badge.progress > 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/30 text-blue-400 border border-blue-800">
                          IN PROGRESS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-500 border border-gray-700">
                          LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4 min-h-[40px] relative z-10">{badge.description}</p>

              {/* Progress Bar */}
              <div className="relative z-10">
                <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2 overflow-hidden border border-gray-700">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${badge.unlocked ? "bg-purple-500" : "bg-gray-600"}`}
                    style={{
                      width: `${Math.min(badge.progress, 100)}%`,
                      backgroundColor: badge.unlocked ? (badge.role_color || "#a855f7") : undefined
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{badge.current_value.toLocaleString()} / {badge.threshold_value.toLocaleString()}</span>
                  <span>{Math.min(badge.progress, 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Reward Action */}
              {badge.unlocked && badge.role_status === "PENDING" && badge.reward_role_id && (
                <div className="mt-4 pt-4 border-t border-gray-700/50 relative z-10">
                  <button
                    className="w-full py-2 text-white rounded text-sm font-bold transition-colors shadow-lg"
                    style={{
                      backgroundColor: badge.role_color || "#4F46E5",
                    }}
                  >
                    Claim Role @Discord
                  </button>
                </div>
              )}
              {badge.unlocked && badge.role_status === "SYNCED" && (
                <div className="mt-4 pt-4 border-t border-gray-700/50 text-center relative z-10">
                  <span className="text-xs text-green-500 font-medium flex items-center justify-center gap-1">
                    Synced to Discord
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AchievementsTab;
