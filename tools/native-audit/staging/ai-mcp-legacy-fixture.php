<?php
/** WP-CLI --require fixture: define legacy symbols before plugin initialization, avoiding compatibility-wrapper recursion. */
function flxseo_mcp_handle() { throw new RuntimeException( 'Fixture protocol handler must never run.' ); }
function flxseo_mcp_tools() {
	return array( 'qa_legacy_read' => array( 'title' => 'Legacy fixture', 'description' => '', 'cap' => 'read', 'readonly' => true, 'run' => static function () { throw new RuntimeException( 'Fixture callback must never run.' ); } ) );
}
