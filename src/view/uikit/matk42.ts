export function resolveThemeByPlatform(platform: string) {
    if (platform) {
        return platform === "macos" || platform === "ios" ? "apple" : "material";
    } else if (navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad|Mac OS/i)) {
        return "apple";
    } else {
        return "material";
    }
}
