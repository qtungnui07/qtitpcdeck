namespace MacroDeckHost.Application.Plugins.Trust;
public sealed record PluginTrustOptions
{
	public static readonly PluginTrustOptions Default = new();

	/// <summary>Overrides the root public keys package signatures are verified against.
	/// <see langword="null" /> (the default) anchors to the pinned Macro Deck root key alone. A deployment
	/// that trusts more than one root - a fork keeping the upstream root alongside its own, for instance -
	/// supplies every key it trusts, and a package signed by any of them verifies.</summary>
	public IReadOnlyList<ReadOnlyMemory<byte>>? RootPublicKeys { get; init; }

	/// <summary>Overrides the single root public key package signatures are verified against. Kept for
	/// callers that name exactly one key; <see cref="RootPublicKeys"/> takes precedence when both are set.
	/// Tests anchor to a throwaway root instead so they never depend on - or risk verifying against - the
	/// real key.</summary>
	public ReadOnlyMemory<byte>? RootPublicKeyOverride { get; init; }

	/// <summary>The roots this deployment trusts, in the order they are tried. Empty means the verifier
	/// falls back to the pinned Macro Deck root key.</summary>
	public IReadOnlyList<ReadOnlyMemory<byte>> EffectiveRootPublicKeys =>
		RootPublicKeys ?? (RootPublicKeyOverride is { } single ? [single] : []);
}
