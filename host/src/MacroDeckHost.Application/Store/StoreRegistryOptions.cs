namespace MacroDeckHost.Application.Store;
public sealed record StoreRegistryOptions
{
	public static readonly Uri OfficialBaseUrl =
		new("https://raw.githubusercontent.com/Macro-Deck-App/Macro-Deck-Store-Registry/main/");

	public static readonly string OfficialOrigin = OfficialBaseUrl.GetLeftPart(UriPartial.Path);

	public static readonly StoreRegistryOptions Default = new();

	public Uri BaseUrl { get; init; } = OfficialBaseUrl;

	public string Origin => BaseUrl.GetLeftPart(UriPartial.Path);

	public bool IsOfficialRegistry => IsOfficial(Origin);

	public static bool IsOfficial(string? origin)
	{
		return origin is not null
			&& Uri.TryCreate(origin, UriKind.Absolute, out var uri)
			&& string.Equals(uri.GetLeftPart(UriPartial.Path), OfficialOrigin, StringComparison.OrdinalIgnoreCase);
	}

	public TimeSpan RefreshInterval { get; init; } = TimeSpan.FromHours(1);

	public TimeSpan RequestTimeout { get; init; } = TimeSpan.FromSeconds(30);

	public TimeSpan DownloadTimeout { get; init; } = TimeSpan.FromMinutes(10);

	// The origin caches every registry path on its own for up to 300 s, so right after a publish the snapshot
	// and its files can disagree until those entries expire. The waits add up to more than that.
	public IReadOnlyList<TimeSpan> UpdateRaceRetryDelays { get; init; } =
		[TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(90), TimeSpan.FromSeconds(210)];

	// A validly signed snapshot stays valid forever, so an origin that simply stops updating can
	// suppress revocations and security releases indefinitely without failing any signature check.
	// Snapshots older than this are reported stale even when every signature verifies.
	public TimeSpan MaxSnapshotAge { get; init; } = TimeSpan.FromDays(14);

	public long MaxRegistryFileBytes { get; init; } = 2L * 1024 * 1024;

	public long MaxRegistryTotalBytes { get; init; } = 64L * 1024 * 1024;

	public int MaxRegistryFiles { get; init; } = 10_000;

	public long MaxArtifactBytes { get; init; } = 256L * 1024 * 1024;

	public long MaxMediaBytes { get; init; } = 8L * 1024 * 1024;

	/// <summary>Overrides the root public keys registry manifests and their certificates are verified
	/// against. <see langword="null" /> (the default) anchors to the pinned Macro Deck root key alone. A
	/// deployment that trusts more than one root - a fork keeping the upstream root alongside its own, for
	/// instance - supplies every key it trusts, and a manifest signed by any of them verifies.</summary>
	public IReadOnlyList<ReadOnlyMemory<byte>>? RootPublicKeys { get; init; }

	/// <summary>Overrides the single root public key registry manifests are verified against. Kept for
	/// callers that name exactly one key; <see cref="RootPublicKeys"/> takes precedence when both are set.
	/// Tests anchor to a throwaway root instead so they never depend on - or risk verifying against - the
	/// real key.</summary>
	public ReadOnlyMemory<byte>? RootPublicKeyOverride { get; init; }

	/// <summary>The roots this deployment trusts, in the order they are tried. Empty means the verifier
	/// falls back to the pinned Macro Deck root key.</summary>
	public IReadOnlyList<ReadOnlyMemory<byte>> EffectiveRootPublicKeys =>
		RootPublicKeys ?? (RootPublicKeyOverride is { } single ? [single] : []);
}
