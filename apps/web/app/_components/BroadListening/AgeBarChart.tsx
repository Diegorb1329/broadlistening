import { Baby, User, UserCheck, Users2, UserX } from "lucide-react";

interface AgeBarChartProps {
  under18: number;
  age18_25: number;
  age25_35: number;
  age35_55: number;
  over55: number;
  className?: string;
}

export const AgeBarChart = ({
  under18,
  age18_25,
  age25_35,
  age35_55,
  over55,
  className = "",
}: AgeBarChartProps) => {
  const total = under18 + age18_25 + age25_35 + age35_55 + over55;

  // Calculate percentages, defaulting to 0 if total is 0
  const under18Percentage = total > 0 ? (under18 / total) * 100 : 0;
  const age18_25Percentage = total > 0 ? (age18_25 / total) * 100 : 0;
  const age25_35Percentage = total > 0 ? (age25_35 / total) * 100 : 0;
  const age35_55Percentage = total > 0 ? (age35_55 / total) * 100 : 0;
  const over55Percentage = total > 0 ? (over55 / total) * 100 : 0;

  const ageGroups = [
    {
      name: "Under 18",
      count: under18,
      percentage: under18Percentage,
      color: "bg-chart-1/20",
      textColor: "text-chart-1",
      icon: Baby,
    },
    {
      name: "18-25",
      count: age18_25,
      percentage: age18_25Percentage,
      color: "bg-chart-2/20",
      textColor: "text-chart-2",
      icon: User,
    },
    {
      name: "25-35",
      count: age25_35,
      percentage: age25_35Percentage,
      color: "bg-chart-3/20",
      textColor: "text-chart-3",
      icon: UserCheck,
    },
    {
      name: "35-55",
      count: age35_55,
      percentage: age35_55Percentage,
      color: "bg-chart-4/20",
      textColor: "text-chart-4",
      icon: Users2,
    },
    {
      name: "Over 55",
      count: over55,
      percentage: over55Percentage,
      color: "bg-chart-5/20",
      textColor: "text-chart-5",
      icon: UserX,
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      {/* Bar Chart */}
      <div className="w-full h-6 bg-muted rounded-full overflow-hidden flex">
        {ageGroups.map((group) => (
          <div
            key={group.name}
            className={`${group.color} h-full flex items-center justify-center transition-all duration-300`}
            style={{ width: `${group.percentage}%` }}
          >
            {group.percentage > 8 && (
              <span className="text-white text-xs font-medium">
                {group.percentage.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
        {ageGroups.map((group) => {
          const IconComponent = group.icon;
          return (
            <div key={group.name} className="flex items-center gap-1">
              <IconComponent className={`size-3 ${group.textColor}`} />
              <span>
                {group.name}: {group.count} ({group.percentage.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
