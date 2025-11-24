import React, { useEffect, useState } from "react";
import api from "../services/api";
import { Badge } from "lucide-react";

interface AchievementData {
  artist_stats: {
    submissions: number;
    avg_score: number;
  };
  streamer_stats: {
    likes: number;
    diamonds: number;
    viewers_peak: number;
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
  }>;
}

const AchievementsTab = () => {
  const [data, setData] = useState<AchievementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) return <div className="text-gray-400 p-8 text-center">Loading Stats...</div>;
  if (!data) return <div className="text-gray-400 p-8 text-center">Failed to load stats.</div>;

  return (
    <div className="space-y-8">
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
      </div>

      {/* Badges Grid */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">Trophy Case</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.badges.map((badge) => (
            <div
              key={badge.slug}
              className={`relative p-5 rounded-lg border transition-all ${
                badge.unlocked
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/50 shadow-lg shadow-purple-900/10"
                  : "bg-gray-900/50 border-gray-800 opacity-70"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className={`font-bold text-lg ${badge.unlocked ? "text-white" : "text-gray-500"}`}>
                  {badge.name}
                </h4>
                {badge.unlocked ? (
                   <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/30 text-green-400 border border-green-800">
                     UNLOCKED
                   </span>
                ) : (
                   <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-500 border border-gray-700">
                     LOCKED
                   </span>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-4 min-h-[40px]">{badge.description}</p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2 overflow-hidden border border-gray-700">
                <div
                  className={`h-2.5 rounded-full ${badge.unlocked ? "bg-purple-500" : "bg-gray-600"}`}
                  style={{ width: `${badge.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{badge.current_value.toLocaleString()} / {badge.threshold_value.toLocaleString()}</span>
                <span>{badge.progress}%</span>
              </div>

              {/* Reward Action */}
              {badge.unlocked && badge.role_status === "PENDING" && badge.reward_role_id && (
                 <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold transition-colors">
                      Claim Role @Discord
                    </button>
                 </div>
              )}
               {badge.unlocked && badge.role_status === "SYNCED" && (
                 <div className="mt-4 pt-4 border-t border-gray-700/50 text-center">
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
