namespace MacroDeck.Signing.Certificates;

/// <summary>
/// Normalises the two ways a caller can name the roots it trusts - a single optional key, or an explicit
/// list - into the list form the verifiers take. A deployment that trusts more than one root (a fork
/// keeping the upstream root alongside its own, for instance) supplies a list; every existing caller that
/// supplies one key, or none, keeps working unchanged.
/// </summary>
public static class RootKeys
{
	/// <summary>The single root every verifier anchors on when the caller names none.</summary>
	public static IReadOnlyList<ReadOnlyMemory<byte>> Default { get; } =
		[MacroDeckRootKey.PublicKey.ToArray()];

	/// <summary>Returns <paramref name="rootPublicKey"/> as a one-entry list, or <see cref="Default"/> when
	/// it is <see langword="null" />.</summary>
	public static IReadOnlyList<ReadOnlyMemory<byte>> Of(ReadOnlyMemory<byte>? rootPublicKey)
	{
		return rootPublicKey.HasValue ? [rootPublicKey.Value] : Default;
	}

	/// <summary>Returns <paramref name="rootPublicKeys"/> unchanged when it names at least one key, or
	/// <see cref="Default"/> when it is <see langword="null" /> or empty. Lets a caller pass an options
	/// record's key list straight through without deciding whether it was configured.</summary>
	public static IReadOnlyList<ReadOnlyMemory<byte>> Of(IReadOnlyList<ReadOnlyMemory<byte>>? rootPublicKeys)
	{
		return rootPublicKeys is { Count: > 0 } ? rootPublicKeys : Default;
	}
}
